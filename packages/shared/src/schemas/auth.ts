import { z } from 'zod';
import { normalizeDigits } from '../digits';
import { text } from './common';

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export const username = z.preprocess(
  (v) => (typeof v === 'string' ? normalizeDigits(v).trim().toLowerCase() : v),
  z.string({ error: 'اسم الدخول مطلوب' }).regex(USERNAME_RE, {
    error: 'اسم الدخول: من ٣ لـ ٣٢ حرف إنجليزي صغير أو رقم (مسموح . و - و _)',
  }),
);

// أشهر كلمات السر اللي بتتخمن بسهولة — مرفوضة
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '11111111', '00000000', '87654321', '12341234',
  'password', 'password1', 'password123', 'qwerty123', 'qwertyuiop', 'iloveyou', 'admin123',
  'admin1234', 'welcome1', 'letmein1', 'abc12345', 'abcd1234', 'a1234567', 'p@ssw0rd',
  'ceramic123', 'rondi123', 'factory123', '123123123', 'aaaaaaaa', 'q1w2e3r4',
]);

export const PASSWORD_MIN = 8;

export const newPassword = z
  .string({ error: 'كلمة السر مطلوبة' })
  .min(PASSWORD_MIN, { error: `كلمة السر لازم تكون ${PASSWORD_MIN} حروف أو أرقام على الأقل` })
  .max(128, { error: 'كلمة السر طويلة جداً' })
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), { error: 'كلمة السر دي مشهورة وسهل تتخمن، اختار غيرها' })
  .refine((p) => new Set(p).size >= 4, { error: 'كلمة السر فيها تكرار كتير، اختار حروف وأرقام متنوعة' });

export const loginSchema = z.object({
  username: z.preprocess(
    (v) => (typeof v === 'string' ? normalizeDigits(v).trim().toLowerCase() : v),
    z.string({ error: 'اسم الدخول مطلوب' }).min(1, { error: 'اسم الدخول مطلوب' }).max(64),
  ),
  password: z.string({ error: 'كلمة السر مطلوبة' }).min(1, { error: 'كلمة السر مطلوبة' }).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: 'كلمة السر الحالية مطلوبة' }).max(128),
    newPassword,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    error: 'كلمة السر الجديدة لازم تختلف عن القديمة',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const mfaCodeSchema = z.object({
  code: z.preprocess(
    (v) => (typeof v === 'string' ? normalizeDigits(v).replace(/\s/g, '') : v),
    z.string().regex(/^\d{6}$/, { error: 'الرمز ٦ أرقام' }),
  ),
});
export type MfaCodeInput = z.infer<typeof mfaCodeSchema>;

export const mfaDisableSchema = z.object({
  password: z.string().min(1, { error: 'كلمة السر مطلوبة' }).max(128),
});

export const passwordField = newPassword;
export const fullName = text(2, 100, 'الاسم');
