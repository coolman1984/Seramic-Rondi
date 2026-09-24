import type { Permission } from '@rondi/shared';

/**
 * مراحل الدخول:
 *  - mfa_verify: كتب كلمة السر صح، ومستني الرمز الإضافي من الموبايل
 *  - password_change: لازم يغير كلمة السر (أول دخول أو بعد ما المدير عمل له كلمة سر جديدة)
 *  - mfa_setup: دوره محتاج رمز إضافي ولسه مفعّلهوش
 *  - active: دخل خلاص
 */
export type AuthStage = 'mfa_verify' | 'password_change' | 'mfa_setup' | 'active';

export interface AuthContext {
  sessionId: string;
  userId: string;
  username: string;
  fullName: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  permissions: ReadonlySet<Permission>;
  stage: AuthStage;
  csrfToken: string;
  mfaEnabled: boolean;
  mfaRequired: boolean;
}

export function stageOf(user: { mfaEnabled: boolean; mustChangePassword: boolean }, role: { mfaRequired: boolean }, session: { mfaPassed: boolean }): AuthStage {
  if (user.mfaEnabled && !session.mfaPassed) return 'mfa_verify';
  if (user.mustChangePassword) return 'password_change';
  if (role.mfaRequired && !user.mfaEnabled) return 'mfa_setup';
  return 'active';
}
