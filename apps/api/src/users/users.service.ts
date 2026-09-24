import { HttpStatus, Injectable } from '@nestjs/common';
import type { ListQuery, UserCreateInput, UserUpdateInput } from '@rondi/shared';
import { decryptNullable, encryptNullable, maskPhone } from '../common/crypto';
import { AppError, notFound, staleVersion } from '../common/errors';
import type { RequestMeta } from '../common/request';
import { AuditService, diff, type Actor } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import type { Prisma, User, Role } from '../generated/prisma/client';
import { PrismaService, type Tx } from '../prisma/prisma.service';

type UserWithRole = User & { role: Role };

/** اللي بيظهر في السجل عن المستخدم: من غير أسرار، والموبايل متغطي نصه. */
function auditView(u: User) {
  return {
    username: u.username,
    fullName: u.fullName,
    phone: maskPhone(decryptNullable(u.phoneEnc)),
    roleId: u.roleId,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    mfaEnabled: u.mfaEnabled,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  private present(u: UserWithRole, canSeePhone: boolean) {
    const phone = decryptNullable(u.phoneEnc);
    return {
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      phone: canSeePhone ? phone : maskPhone(phone),
      role: { id: u.role.id, code: u.role.code, name: u.role.name },
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
      mfaEnabled: u.mfaEnabled,
      locked: !!u.lockedUntil && u.lockedUntil > new Date(),
      lockedUntil: u.lockedUntil,
      lastLoginAt: u.lastLoginAt,
      version: u.version,
      createdAt: u.createdAt,
    };
  }

  async list(q: ListQuery, canSeePhone: boolean) {
    const where: Prisma.UserWhereInput = {
      isActive: q.includeInactive ? undefined : true,
      OR: q.q
        ? [{ username: { contains: q.q, mode: 'insensitive' } }, { fullName: { contains: q.q, mode: 'insensitive' } }]
        : undefined,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, include: { role: true }, orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    ]);
    return { total, page: q.page, pageSize: q.pageSize, rows: rows.map((u) => this.present(u, canSeePhone)) };
  }

  async get(id: string, canSeePhone: boolean) {
    const u = await this.prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!u) throw notFound('المستخدم');
    return this.present(u, canSeePhone);
  }

  async create(input: UserCreateInput, actor: Actor, meta: RequestMeta) {
    const passwordHash = await this.passwords.hash(input.password);
    return this.prisma.$transaction(async (tx) => {
      await this.requireActiveRole(tx, input.roleId);
      const u = await tx.user.create({
        data: {
          username: input.username,
          fullName: input.fullName,
          phoneEnc: encryptNullable(input.phone),
          roleId: input.roleId,
          passwordHash,
          mustChangePassword: true,
        },
        include: { role: true },
      });
      await this.audit.record(tx, actor, meta, { action: 'CREATE', entity: 'user', entityId: u.id, after: auditView(u) });
      return this.present(u, true);
    });
  }

  async update(id: string, input: UserUpdateInput & { version: number }, actor: Actor, meta: RequestMeta) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id } });
      if (!before) throw notFound('المستخدم');
      if (input.roleId && input.roleId !== before.roleId) await this.requireActiveRole(tx, input.roleId);
      const res = await tx.user.updateMany({
        where: { id, version: input.version },
        data: {
          fullName: input.fullName,
          phoneEnc: input.phone === undefined ? undefined : encryptNullable(input.phone),
          roleId: input.roleId,
          version: { increment: 1 },
        },
      });
      if (res.count === 0) throw staleVersion();
      const after = await tx.user.findUniqueOrThrow({ where: { id }, include: { role: true } });
      if (before.roleId !== after.roleId) {
        await this.ensureAdminRemains(tx);
        // الصلاحيات اتغيرت: يدخل تاني عشان يشوف الشاشات الجديدة
        await this.sessions.revokeAllForUser(tx, id, 'role_changed');
      }
      const d = diff(auditView(before), auditView(after));
      if (d) await this.audit.record(tx, actor, meta, { action: 'UPDATE', entity: 'user', entityId: id, ...d });
      return this.present(after, true);
    });
  }

  async setActive(id: string, active: boolean, version: number, actor: Actor, meta: RequestMeta) {
    if (!active && id === actor.userId) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'SELF_DEACTIVATE', 'مينفعش توقف حسابك انت');
    }
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.user.updateMany({ where: { id, version }, data: { isActive: active, version: { increment: 1 } } });
      if (res.count === 0) throw (await tx.user.findUnique({ where: { id } })) ? staleVersion() : notFound('المستخدم');
      if (!active) {
        await this.ensureAdminRemains(tx);
        await this.sessions.revokeAllForUser(tx, id, 'deactivated');
      }
      await this.audit.record(tx, actor, meta, {
        action: active ? 'ACTIVATE' : 'DEACTIVATE',
        entity: 'user',
        entityId: id,
        before: { isActive: !active },
        after: { isActive: active },
      });
      return this.present(await tx.user.findUniqueOrThrow({ where: { id }, include: { role: true } }), true);
    });
  }

  async resetPassword(id: string, newPassword: string, actor: Actor, meta: RequestMeta) {
    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id } });
      if (!u) throw notFound('المستخدم');
      await tx.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null, version: { increment: 1 } },
      });
      await this.sessions.revokeAllForUser(tx, id, 'password_reset');
      await this.audit.record(tx, actor, meta, { action: 'PASSWORD_RESET', entity: 'user', entityId: id });
    });
  }

  async unlock(id: string, actor: Actor, meta: RequestMeta) {
    await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id } });
      if (!u) throw notFound('المستخدم');
      await tx.user.update({ where: { id }, data: { failedLoginCount: 0, lockedUntil: null } });
      await this.audit.record(tx, actor, meta, { action: 'UNLOCK', entity: 'user', entityId: id, before: { lockedUntil: u.lockedUntil }, after: { lockedUntil: null } });
    });
  }

  async resetMfa(id: string, actor: Actor, meta: RequestMeta) {
    await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id } });
      if (!u) throw notFound('المستخدم');
      await tx.user.update({ where: { id }, data: { mfaEnabled: false, mfaSecretEnc: null, mfaLastStep: null, version: { increment: 1 } } });
      await this.sessions.revokeAllForUser(tx, id, 'mfa_reset');
      await this.audit.record(tx, actor, meta, { action: 'MFA_RESET', entity: 'user', entityId: id, before: { mfaEnabled: u.mfaEnabled }, after: { mfaEnabled: false } });
    });
  }

  private async requireActiveRole(tx: Tx, roleId: string) {
    const role = await tx.role.findUnique({ where: { id: roleId } });
    if (!role || !role.isActive) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'الدور ده مش موجود', { fields: { roleId: 'اختار دور موجود' } });
    }
  }

  /** لازم يفضل دايماً مستخدم واحد على الأقل يقدر يدير المستخدمين والصلاحيات، وإلا النظام يتقفل على الكل. */
  async ensureAdminRemains(tx: Tx) {
    const count = await tx.user.count({
      where: { isActive: true, role: { isActive: true, permissions: { hasEvery: ['users.manage', 'roles.manage'] } } },
    });
    if (count === 0) {
      throw new AppError(HttpStatus.CONFLICT, 'LAST_ADMIN', 'لازم يفضل مستخدم واحد على الأقل بيدير المستخدمين والصلاحيات.');
    }
  }
}
