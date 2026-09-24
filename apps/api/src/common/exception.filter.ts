import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import type { RequestWithAuth } from './request';

/**
 * أي خطأ بيرجع للمستخدم برسالة مفهومة ومن غير تفاصيل داخلية
 * (مفيش أسماء جداول ولا مسارات ملفات ولا stack trace).
 * التفاصيل الكاملة بتتسجل عندنا في سجل السيرفر مع رقم الطلب.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestWithAuth>();
    const requestId = req.meta?.requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = { code: 'INTERNAL', message: 'حصلت مشكلة في السيرفر. جرب تاني، ولو اتكررت بلّغ مدير النظام.' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      if (typeof r === 'object' && r && 'code' in r) body = r as Record<string, unknown>;
      else body = { code: defaultCode(status), message: defaultMessage(status) };
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        body = { code: 'DUPLICATE', message: 'القيمة دي متسجلة قبل كده (الكود أو الاسم مكرر).' };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        body = { code: 'NOT_FOUND', message: 'السجل مش موجود' };
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        body = { code: 'INVALID_REFERENCE', message: 'في اختيار مربوط بحاجة مش موجودة' };
      }
    } else if (isBodyParserError(exception)) {
      // بيانات بايظة أو أكبر من المسموح (قبل ما توصل لأي كود عندنا)
      status = exception.status;
      body = { code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST', message: defaultMessage(status) };
    } else if (isDbGuard(exception)) {
      status = HttpStatus.FORBIDDEN;
      body = { code: 'DB_GUARD', message: 'العملية دي ممنوعة لحماية البيانات.' };
    }

    if (status >= 500) {
      this.logger.error(`[${requestId}] ${req.method} ${req.originalUrl}`, exception instanceof Error ? exception.stack : String(exception));
    }
    res.status(status).json({ ...body, requestId });
  }
}

function isBodyParserError(e: unknown): e is { status: number; type: string } {
  const x = e as { status?: unknown; type?: unknown } | null;
  return !!x && typeof x.status === 'number' && x.status >= 400 && x.status < 500 && typeof x.type === 'string';
}

function isDbGuard(e: unknown): boolean {
  return e instanceof Error && /rondi: /.test(e.message);
}

function defaultCode(status: number) {
  switch (status) {
    case 401: return 'UNAUTHENTICATED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 429: return 'TOO_MANY_REQUESTS';
    default: return status >= 500 ? 'INTERNAL' : 'BAD_REQUEST';
  }
}

function defaultMessage(status: number) {
  switch (status) {
    case 401: return 'لازم تسجل دخول الأول';
    case 403: return 'مش مسموح لك بالعملية دي';
    case 404: return 'الصفحة أو السجل مش موجود';
    case 429: return 'طلبات كتير ورا بعض. استنى دقيقة وجرب تاني.';
    case 413: return 'البيانات المبعوتة كبيرة جداً';
    case 400: return 'الطلب مش صحيح';
    default: return status >= 500 ? 'حصلت مشكلة في السيرفر' : 'الطلب مش صحيح';
  }
}
