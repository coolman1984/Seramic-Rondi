import { HttpStatus, Injectable } from '@nestjs/common';
import type { ChangePasswordInput, LoginInput } from '@rondi/shared';
import { env } from '../config/env';
import { decrypt, encrypt } from '../common/crypto';
import { AppError } from '../common/errors';
import type { RequestMeta } from '../common/request';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from './auth.types';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

const BAD_LOGIN = () =>
  new AppError(HttpStatus.UNAUTHORIZED, 'BAD_CREDENTIALS', 'اسم الدخول أو كلمة السر غلط. بعد كذا محاولة غلط ورا بعض الحساب بيتقفل مؤقتاً.');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly audit: AuditService,
  ) {}

  async login(input: LoginInput, meta: RequestMeta) {
    const user = await this.prisma.user.findFirst({
      where: { username: { equals: input.username, mode: 'insensitive' } },
      include: { role: true },
    });

    if (!user || !user.isActive || !user.role.isActive) {
      await this.passwords.burn(input.password);
      await this.audit.record(this.prisma, { userId: user?.id ?? null, name: null }, meta, {
        action: 'LOGIN_FAILED',
        entity: 'auth',
        entityId: input.username.slice(0, 64),
        after: { reason: user ? 'inactive' : 'unknown_user' },
      });
      throw BAD_LOGIN();
    }

    const actor = { userId: user.id, name: user.fullName };
    const passwordOk = await this.passwords.verify(user.passwordHash, input.password);

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.record(this.prisma, actor, meta, { action: 'LOGIN_BLOCKED', entity: 'user', entityId: user.id });
      if (!passwordOk) throw BAD_LOGIN();
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new AppError(HttpStatus.LOCKED, 'ACCOUNT_LOCKED', `الحساب مقفول مؤقتاً بسبب محاولات غلط كتير. جرب بعد ${minutes} دقيقة أو كلّم مدير النظام.`, { minutes });
    }

    if (!passwordOk) {
      await this.registerFailure(user.id, actor, meta, 'bad_password');
      throw BAD_LOGIN();
    }

    const newHash = this.passwords.needsRehash(user.passwordHash) ? await this.passwords.hash(input.password) : undefined;

    const { token, session } = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), ...(newHash ? { passwordHash: newHash } : {}) },
      });
      const created = await this.sessions.create(tx, user.id, meta, false);
      await this.audit.record(tx, actor, meta, { action: 'LOGIN', entity: 'user', entityId: user.id });
      return created;
    });
    return { token, expiresAt: session.expiresAt };
  }

  /** كل محاولة غلط بتتعد، ولما توصل للحد الحساب بيتقفل مؤقتاً. */
  private async registerFailure(userId: string, actor: { userId: string; name: string }, meta: RequestMeta, reason: string) {
    const { LOGIN_MAX_ATTEMPTS, LOGIN_LOCK_MINUTES } = env();
    await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: userId }, data: { failedLoginCount: { increment: 1 } } });
      await this.audit.record(tx, actor, meta, { action: 'LOGIN_FAILED', entity: 'user', entityId: userId, after: { reason, attempt: u.failedLoginCount } });
      if (u.failedLoginCount >= LOGIN_MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000);
        await tx.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil } });
        await this.sessions.revokeAllForUser(tx, userId, 'locked');
        await this.audit.record(tx, actor, meta, { action: 'ACCOUNT_LOCKED', entity: 'user', entityId: userId, after: { lockedUntil } });
      }
    });
  }

  async logout(auth: AuthContext, meta: RequestMeta) {
    await this.prisma.$transaction(async (tx) => {
      await this.sessions.revoke(tx, auth.sessionId, 'logout');
      await this.audit.record(tx, { userId: auth.userId, name: auth.fullName }, meta, { action: 'LOGOUT', entity: 'user', entityId: auth.userId });
    });
  }

  profile(auth: AuthContext) {
    return {
      user: { id: auth.userId, username: auth.username, fullName: auth.fullName, role: { code: auth.roleCode, name: auth.roleName } },
      permissions: [...auth.permissions],
      stage: auth.stage,
      csrfToken: auth.csrfToken,
      mfaEnabled: auth.mfaEnabled,
      mfaRequired: auth.mfaRequired,
    };
  }

  async changePassword(auth: AuthContext, input: ChangePasswordInput, meta: RequestMeta) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (!(await this.passwords.verify(user.passwordHash, input.currentPassword))) {
      await this.registerFailure(user.id, { userId: user.id, name: user.fullName }, meta, 'bad_current_password');
      throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'كلمة السر الحالية غلط', { fields: { currentPassword: 'كلمة السر الحالية غلط' } });
    }
    if (input.newPassword.toLowerCase().includes(user.username.toLowerCase())) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'كلمة السر مينفعش يكون فيها اسم الدخول', { fields: { newPassword: 'كلمة السر مينفعش يكون فيها اسم الدخول' } });
    }
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date(), version: { increment: 1 } },
      });
      // أي جهاز تاني كان داخل بالحساب ده بيخرج
      await this.sessions.revokeAllForUser(tx, user.id, 'password_changed', auth.sessionId);
      await this.audit.record(tx, { userId: user.id, name: user.fullName }, meta, { action: 'PASSWORD_CHANGE', entity: 'user', entityId: user.id });
    });
  }

  // ───── الرمز الإضافي ─────

  async mfaSetup(auth: AuthContext) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (user.mfaEnabled) throw new AppError(HttpStatus.CONFLICT, 'MFA_ALREADY_ENABLED', 'الرمز الإضافي متفعّل بالفعل');
    const secret = this.mfa.newSecret();
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaSecretEnc: encrypt(secret), mfaLastStep: null } });
    return this.mfa.enrollment(secret, user.username);
  }

  async mfaEnable(auth: AuthContext, code: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (user.mfaEnabled) throw new AppError(HttpStatus.CONFLICT, 'MFA_ALREADY_ENABLED', 'الرمز الإضافي متفعّل بالفعل');
    if (!user.mfaSecretEnc) throw new AppError(HttpStatus.BAD_REQUEST, 'MFA_NO_SETUP', 'ابدأ خطوة التفعيل الأول');
    const step = await this.mfa.check(decrypt(user.mfaSecretEnc), code, null);
    if (step === null) throw new AppError(HttpStatus.BAD_REQUEST, 'MFA_BAD_CODE', 'الرمز غلط أو انتهى. اكتب الرمز اللي ظاهر دلوقتي في التطبيق.');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { mfaEnabled: true, mfaLastStep: step, version: { increment: 1 } } });
      await tx.session.update({ where: { id: auth.sessionId }, data: { mfaPassed: true } });
      await this.sessions.revokeAllForUser(tx, user.id, 'mfa_enabled', auth.sessionId);
      await this.audit.record(tx, { userId: user.id, name: user.fullName }, meta, { action: 'MFA_ENABLE', entity: 'user', entityId: user.id });
    });
  }

  async mfaVerify(auth: AuthContext, code: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (!user.mfaEnabled || !user.mfaSecretEnc) throw new AppError(HttpStatus.BAD_REQUEST, 'MFA_NOT_ENABLED', 'الرمز الإضافي مش متفعّل');
    const step = await this.mfa.check(decrypt(user.mfaSecretEnc), code, user.mfaLastStep);
    const actor = { userId: user.id, name: user.fullName };
    if (step === null) {
      await this.registerFailure(user.id, actor, meta, 'bad_mfa_code');
      throw new AppError(HttpStatus.BAD_REQUEST, 'MFA_BAD_CODE', 'الرمز غلط أو انتهى. اكتب الرمز اللي ظاهر دلوقتي في التطبيق.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { mfaLastStep: step, failedLoginCount: 0 } });
      await tx.session.update({ where: { id: auth.sessionId }, data: { mfaPassed: true } });
      await this.audit.record(tx, actor, meta, { action: 'MFA_VERIFY', entity: 'user', entityId: user.id });
    });
  }

  async mfaDisable(auth: AuthContext, password: string, meta: RequestMeta) {
    if (auth.mfaRequired) throw new AppError(HttpStatus.FORBIDDEN, 'MFA_REQUIRED', 'دورك في النظام لازم يكون معاه رمز إضافي، مينفعش يتلغي.');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      await this.registerFailure(user.id, { userId: user.id, name: user.fullName }, meta, 'bad_password_mfa_disable');
      throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'كلمة السر غلط', { fields: { password: 'كلمة السر غلط' } });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecretEnc: null, mfaLastStep: null, version: { increment: 1 } } });
      await this.audit.record(tx, { userId: user.id, name: user.fullName }, meta, { action: 'MFA_DISABLE', entity: 'user', entityId: user.id });
    });
  }

  // ───── الأجهزة المفتوحة ─────

  async listSessions(auth: AuthContext) {
    const rows = await this.prisma.session.findMany({
      where: { userId: auth.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true },
    });
    return rows.map((r) => ({ ...r, current: r.id === auth.sessionId }));
  }

  async revokeSession(auth: AuthContext, sessionId: string, meta: RequestMeta) {
    const s = await this.prisma.session.findFirst({ where: { id: sessionId, userId: auth.userId } });
    if (!s) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'الجهاز ده مش موجود');
    await this.prisma.$transaction(async (tx) => {
      await this.sessions.revoke(tx, s.id, 'user_revoked');
      await this.audit.record(tx, { userId: auth.userId, name: auth.fullName }, meta, { action: 'SESSION_REVOKE', entity: 'session', entityId: s.id });
    });
  }
}
