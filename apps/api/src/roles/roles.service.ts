import { HttpStatus, Injectable } from '@nestjs/common';
import type { RoleCreateInput, RoleUpdateInput } from '@rondi/shared';
import { AppError, notFound, staleVersion } from '../common/errors';
import type { RequestMeta } from '../common/request';
import { AuditService, diff, type Actor } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

// دور مدير النظام لازم يفضل معاه الصلاحيات دي دايماً
const ADMIN_LOCKED = ['users.read', 'users.manage', 'roles.manage', 'audit.read'];

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly users: UsersService) {}

  async list() {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { users: { where: { isActive: true } } } } },
    });
    return roles.map(({ _count, ...r }) => ({ ...r, activeUsers: _count.users }));
  }

  async create(input: RoleCreateInput, actor: Actor, meta: RequestMeta) {
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({ data: { ...input, description: input.description ?? null, isSystem: false } });
      await this.audit.record(tx, actor, meta, { action: 'CREATE', entity: 'role', entityId: role.id, after: role });
      return role;
    });
  }

  async update(id: string, input: RoleUpdateInput & { version: number }, actor: Actor, meta: RequestMeta) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.role.findUnique({ where: { id } });
      if (!before) throw notFound('الدور');
      if (before.code === 'SYSTEM_ADMIN' && input.permissions && !ADMIN_LOCKED.every((p) => input.permissions!.includes(p as never))) {
        throw new AppError(HttpStatus.BAD_REQUEST, 'ADMIN_ROLE_LOCKED', 'دور مدير النظام لازم يفضل يقدر يدير المستخدمين والصلاحيات ويشوف السجل.');
      }
      const { version, ...data } = input;
      const res = await tx.role.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
      if (res.count === 0) throw staleVersion();
      const after = await tx.role.findUniqueOrThrow({ where: { id } });
      await this.users.ensureAdminRemains(tx);
      const d = diff(before, after);
      if (d) await this.audit.record(tx, actor, meta, { action: 'UPDATE', entity: 'role', entityId: id, ...d });
      return after;
    });
  }
}
