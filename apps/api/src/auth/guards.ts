import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { Permission } from '@rondi/shared';
import { env } from '../config/env';
import { safeEqual } from '../common/crypto';
import { ALLOWED_STAGES, IS_PUBLIC, REQUIRED_PERMISSIONS } from '../common/decorators';
import { AppError } from '../common/errors';
import type { RequestWithAuth } from '../common/request';
import type { AuthStage } from './auth.types';
import { SessionService } from './session.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** ١) مين انت؟ — كل طلب لازم يكون معاه جلسة سليمة، إلا المسارات المفتوحة. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly sessions: SessionService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<RequestWithAuth>();
    const token = (req.cookies as Record<string, string> | undefined)?.[this.sessions.cookieName()];
    const auth = token ? await this.sessions.resolve(token) : null;
    if (!auth) {
      if (token) this.sessions.clearCookie(ctx.switchToHttp().getResponse<Response>());
      throw new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'الجلسة انتهت. سجّل دخول تاني.');
    }
    req.auth = auth;
    const allowed = this.reflector.getAllAndOverride<AuthStage[]>(ALLOWED_STAGES, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (auth.stage !== 'active' && !allowed.includes(auth.stage)) {
      throw new AppError(HttpStatus.FORBIDDEN, 'AUTH_STAGE', 'كمّل خطوات الدخول الأول', { stage: auth.stage });
    }
    return true;
  }
}

/**
 * ٢) الطلب جاي من شاشاتنا فعلاً؟ — حماية من إن موقع تاني يبعت طلبات باسم المستخدم.
 * أي طلب بيغيّر حاجة لازم يكون معاه رمز الجلسة الخاص (x-csrf-token) أو علامة إنه من شاشاتنا،
 * ولو المتصفح بعت مصدر الطلب (Origin) لازم يكون موقعنا.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequestWithAuth>();
    if (SAFE_METHODS.has(req.method)) return true;

    const origin = req.headers.origin;
    if (origin && origin !== env().APP_ORIGIN) throw forbiddenCsrf();

    if (req.auth) {
      const header = req.headers['x-csrf-token'];
      if (typeof header !== 'string' || !safeEqual(header, req.auth.csrfToken)) throw forbiddenCsrf();
    } else if (req.headers['x-requested-with'] !== 'rondi') {
      throw forbiddenCsrf();
    }
    return true;
  }
}

function forbiddenCsrf() {
  return new AppError(HttpStatus.FORBIDDEN, 'CSRF', 'الطلب مرفوض لأسباب أمنية. حدّث الصفحة وجرب تاني.');
}

/** ٣) مسموح لك؟ — الصلاحيات بتتفحص هنا على السيرفر، مش بس بإخفاء الزرار في الشاشة. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS, [ctx.getHandler(), ctx.getClass()]);
    if (!required?.length) return true;
    const auth = ctx.switchToHttp().getRequest<RequestWithAuth>().auth;
    if (!auth || !required.every((p) => auth.permissions.has(p))) {
      throw new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'مش مسموح لك بالعملية دي');
    }
    return true;
  }
}
