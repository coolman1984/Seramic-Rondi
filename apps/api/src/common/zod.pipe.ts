import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

/** بيفحص أي بيانات داخلة على القواعد المشتركة، ويرجّع الأخطاء بالعربي لكل خانة. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    const fields: Record<string, string> = {};
    let formError: string | undefined;
    for (const issue of result.error.issues) {
      const key = issue.path.map(String).join('.');
      if (!key) formError ??= issue.message;
      else fields[key] ??= issue.message;
    }
    throw new BadRequestException({
      code: 'VALIDATION',
      message: formError ?? 'في بيانات محتاجة تتصلح',
      fields,
    });
  }
}
