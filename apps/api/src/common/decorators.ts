import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission } from '@rondi/shared';
import type { AuthContext, AuthStage } from '../auth/auth.types';
import type { RequestWithAuth } from './request';

export const IS_PUBLIC = 'rondi:public';
export const REQUIRED_PERMISSIONS = 'rondi:permissions';
export const ALLOWED_STAGES = 'rondi:stages';

/** المسار ده مفتوح من غير تسجيل دخول (زي صفحة الدخول نفسها). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** لازم المستخدم يكون عنده كل الصلاحيات دي. */
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(REQUIRED_PERMISSIONS, perms);

/** المسار ده متاح حتى لو المستخدم لسه في خطوة (تغيير كلمة السر، الرمز الإضافي). */
export const AllowStages = (...stages: AuthStage[]) => SetMetadata(ALLOWED_STAGES, stages);

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<RequestWithAuth>();
  if (!req.auth) throw new Error('CurrentAuth used on a public route');
  return req.auth;
});

export const Meta = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<RequestWithAuth>();
  return req.meta;
});
