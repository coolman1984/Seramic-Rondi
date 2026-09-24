import { Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { isPermission, type Permission } from '@rondi/shared';
import { env } from '../config/env';
import { randomToken, sha256Hex } from '../common/crypto';
import type { RequestMeta } from '../common/request';
import { PrismaService, type Tx } from '../prisma/prisma.service';
import { stageOf, type AuthContext } from './auth.types';

/**
 * الجلسة = "أنا داخل". المتصفح بياخد رمز عشوائي في كوكي محمية
 * (مايقدرش أي كود في الصفحة يقراها)، وإحنا بنخزن بصمته بس.
 * الجلسة بتنتهي بعد مدة ثابتة، أو لو المستخدم ساب الجهاز فترة من غير استخدام.
 */
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  cookieName(): string {
    return env().COOKIE_SECURE ? '__Host-rondi_sid' : 'rondi_sid';
  }

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: env().COOKIE_SECURE, sameSite: 'strict', path: '/' };
  }

  setCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(this.cookieName(), token, { ...this.cookieOptions(), expires: expiresAt });
  }

  clearCookie(res: Response) {
    res.clearCookie(this.cookieName(), this.cookieOptions());
  }

  async create(tx: Tx, userId: string, meta: RequestMeta, mfaPassed: boolean) {
    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + env().SESSION_ABSOLUTE_HOURS * 3600_000);
    const session = await tx.session.create({
      data: {
        tokenHash: sha256Hex(token),
        csrfToken: randomToken(24),
        userId,
        mfaPassed,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        expiresAt,
      },
    });
    // حد أقصى للجلسات المفتوحة لكل مستخدم: الأقدم بيتقفل
    const open = await tx.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const extra = open.slice(env().SESSION_MAX_PER_USER).map((s) => s.id);
    if (extra.length) {
      await tx.session.updateMany({ where: { id: { in: extra } }, data: { revokedAt: new Date(), revokeReason: 'too_many' } });
    }
    return { token, session };
  }

  /** بيرجّع بيانات الدخول لو الجلسة سليمة، أو null لو منتهية/مقفولة. */
  async resolve(token: string): Promise<AuthContext | null> {
    if (!token || token.length > 128) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256Hex(token) },
      include: { user: { include: { role: true } } },
    });
    if (!session || session.revokedAt) return null;
    const now = Date.now();
    const idleMs = env().SESSION_IDLE_MINUTES * 60_000;
    if (session.expiresAt.getTime() <= now || session.lastSeenAt.getTime() + idleMs <= now) {
      await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date(), revokeReason: 'expired' } });
      return null;
    }
    const { user } = session;
    if (!user.isActive || !user.role.isActive) return null;

    if (now - session.lastSeenAt.getTime() > 60_000) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    }

    const stage = stageOf(user, user.role, session);
    const permissions = new Set<Permission>(stage === 'active' ? user.role.permissions.filter(isPermission) : []);
    return {
      sessionId: session.id,
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      roleId: user.roleId,
      roleCode: user.role.code,
      roleName: user.role.name,
      permissions,
      stage,
      csrfToken: session.csrfToken,
      mfaEnabled: user.mfaEnabled,
      mfaRequired: user.role.mfaRequired,
    };
  }

  async revoke(tx: Tx | PrismaService, sessionId: string, reason: string) {
    await tx.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: reason } });
  }

  async revokeAllForUser(tx: Tx | PrismaService, userId: string, reason: string, exceptSessionId?: string) {
    await tx.session.updateMany({
      where: { userId, revokedAt: null, id: exceptSessionId ? { not: exceptSessionId } : undefined },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }
}
