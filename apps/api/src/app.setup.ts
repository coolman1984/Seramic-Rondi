import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import type { RequestWithAuth } from './common/request';

/** إعدادات الحماية العامة للخادم — بتتطبق في التشغيل وفي الاختبارات بنفس الشكل. */
export function configureApp(app: INestApplication) {
  const express = app as NestExpressApplication;
  const cfg = env();

  express.disable('x-powered-by');
  if (cfg.TRUST_PROXY > 0) express.set('trust proxy', cfg.TRUST_PROXY);
  express.setGlobalPrefix('api');
  express.useBodyParser('json', { limit: '256kb' });
  express.useBodyParser('urlencoded', { limit: '64kb', extended: false });

  express.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      hsts: cfg.COOKIE_SECURE ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );
  express.use(cookieParser());
  express.use((req: RequestWithAuth, res: Response, next: NextFunction) => {
    req.meta = {
      requestId: randomUUID(),
      ip: req.ip ?? null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : null,
    };
    res.setHeader('X-Request-Id', req.meta.requestId);
    // الردود فيها بيانات المصنع: متتخزنش في أي كاش وسيط
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  // مفيش CORS: الشاشات والخادم على نفس العنوان، وأي موقع تاني مرفوض.
  express.enableShutdownHooks();
  return express;
}
