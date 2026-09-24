import { ConflictException, HttpException, HttpStatus } from '@nestjs/common';

/** أخطاء متفق عليها ليها كود ثابت ورسالة بالعربي للمستخدم. */
export class AppError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, extra: Record<string, unknown> = {}) {
    super({ code, message, ...extra }, status);
  }
}

export const staleVersion = () =>
  new ConflictException({
    code: 'STALE_VERSION',
    message: 'حد تاني عدّل السجل ده من شوية. افتحه تاني عشان تشوف آخر نسخة.',
  });

export const notFound = (what = 'السجل') => new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${what} مش موجود`);
