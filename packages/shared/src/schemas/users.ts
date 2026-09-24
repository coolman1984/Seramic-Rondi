import { z } from 'zod';
import { normalizeDigits } from '../digits';
import { isPermission, type Permission } from '../permissions';
import { fullName, newPassword, username } from './auth';
import { id, optionalText, text } from './common';

const phone = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    const s = normalizeDigits(v).replace(/[\s-]/g, '');
    return s === '' ? null : s;
  },
  z
    .string()
    .regex(/^\+?\d{8,15}$/, { error: 'رقم الموبايل غير صحيح' })
    .nullable()
    .optional(),
);

export const userCreateSchema = z.object({
  username,
  fullName,
  phone,
  roleId: id,
  password: newPassword,
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z
  .object({ fullName, phone, roleId: id })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { error: 'مفيش حاجة اتغيرت' });
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const resetPasswordSchema = z.object({ newPassword });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

const permissionList = z
  .array(z.string())
  .max(200)
  .refine((arr) => arr.every(isPermission), { error: 'صلاحية غير معروفة' })
  .transform((arr) => Array.from(new Set(arr)) as Permission[]);

export const roleCreateSchema = z.object({
  code: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
    z.string().regex(/^[A-Z][A-Z0-9_]{2,39}$/, { error: 'كود الدور: حروف إنجليزي كبيرة وأرقام و _ بس' }),
  ),
  name: text(2, 60, 'اسم الدور'),
  description: optionalText(300, 'الوصف'),
  mfaRequired: z.boolean().default(false),
  permissions: permissionList,
});
export type RoleCreateInput = z.infer<typeof roleCreateSchema>;

export const roleUpdateSchema = z
  .object({
    name: text(2, 60, 'اسم الدور'),
    description: optionalText(300, 'الوصف'),
    mfaRequired: z.boolean(),
    permissions: permissionList,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { error: 'مفيش حاجة اتغيرت' });
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;

export const auditQuerySchema = z.object({
  entity: z.string().max(40).optional(),
  entityId: z.string().max(64).optional(),
  actorId: id.optional(),
  action: z.string().max(40).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;
