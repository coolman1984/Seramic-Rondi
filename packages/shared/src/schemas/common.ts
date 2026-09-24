import { z } from 'zod';
import { normalizeDigits, parseLooseNumber } from '../digits';

// رسائل الأخطاء الافتراضية بالعربي
z.config(z.locales.ar());

// أي حروف تحكم مخفية (غير السطر الجديد والتاب) مرفوضة
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/;

/** نص عادي: بيتشال منه المسافات الزيادة، وله حد أدنى وأقصى، ومفيهوش حروف مخفية. */
export const text = (min: number, max: number, label = 'الخانة') =>
  z
    .string({ error: `${label} مطلوبة` })
    .trim()
    .min(min, { error: min <= 1 ? `${label} مطلوبة` : `${label} لازم تكون ${min} حروف على الأقل` })
    .max(max, { error: `${label} أطول من ${max} حرف` })
    .refine((s) => !CONTROL_CHARS.test(s), { error: `${label} فيها رموز غير مسموحة` });

export const optionalText = (max: number, label = 'الخانة') =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    text(1, max, label).nullable().optional(),
  );

/** كود قصير (موديل، مقاس، درجة لون...): حروف عربي أو إنجليزي وأرقام وشرطة. */
export const code = (label = 'الكود', max = 20) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? normalizeDigits(v).trim().toUpperCase() : v),
    z
      .string({ error: `${label} مطلوب` })
      .min(1, { error: `${label} مطلوب` })
      .max(max, { error: `${label} أطول من ${max} حرف` })
      .regex(/^[\p{L}\p{N}][\p{L}\p{N}._\-/]*$/u, { error: `${label}: حروف وأرقام بس، ومن غير مسافات` }),
  );

/** رقم بيقبل الأرقام العربي والإنجليزي. */
export const num = (label = 'الرقم') =>
  z.preprocess((v) => {
    if (typeof v === 'string') return v.trim() === '' ? undefined : parseLooseNumber(v);
    return v;
  }, z.number({ error: `${label} لازم يكون رقم` }).refine(Number.isFinite, { error: `${label} لازم يكون رقم` }));

export const int = (label: string, min: number, max: number) =>
  num(label).pipe(
    z
      .number()
      .int({ error: `${label} لازم يكون رقم صحيح` })
      .min(min, { error: `${label} لازم يكون ${min} أو أكتر` })
      .max(max, { error: `${label} لازم يكون ${max} أو أقل` }),
  );

export const decimal = (label: string, min: number, max: number) =>
  num(label).pipe(
    z
      .number()
      .min(min, { error: `${label} لازم يكون ${min} أو أكتر` })
      .max(max, { error: `${label} لازم يكون ${max} أو أقل` }),
  );

export const id = z.uuid({ error: 'اختيار غير صحيح' });

export const bool = z.preprocess((v) => {
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return v;
}, z.boolean());

export const listQuerySchema = z.object({
  q: z.preprocess((v) => (typeof v === 'string' ? normalizeDigits(v).trim() : v), z.string().max(100).optional()),
  page: int('الصفحة', 1, 100000).default(1),
  pageSize: int('عدد الصفوف', 1, 200).default(50),
  includeInactive: bool.default(false),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

/** وقت بصيغة 06:00 */
export const timeOfDay = (label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? normalizeDigits(v).trim() : v),
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: `${label} لازم يكون بالشكل ٠٦:٠٠` }),
  );
