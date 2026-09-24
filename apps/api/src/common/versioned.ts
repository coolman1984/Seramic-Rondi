import { z } from 'zod';

/** أي تعديل لازم يبعت رقم النسخة اللي شافها، عشان لو حد عدّل قبله ياخد تنبيه بدل ما يمسح شغله. */
export const versionField = z.object({ version: z.number({ error: 'رقم النسخة مطلوب' }).int().min(1) });

export function versioned<T extends z.ZodType>(schema: T) {
  return z.intersection(schema, versionField);
}
