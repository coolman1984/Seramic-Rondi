import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
loadDotenv({ quiet: true });
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { env } from './config/env';

async function bootstrap() {
  const cfg = env(); // لو في إعداد ناقص، البرنامج بيقف هنا برسالة واضحة
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, logger: ['error', 'warn', 'log'] });
  configureApp(app);
  await app.listen(cfg.PORT, '0.0.0.0');
  new Logger('Rondi').log(`API listening on :${cfg.PORT}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
