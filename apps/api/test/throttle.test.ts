import type { INestApplication } from '@nestjs/common';
import { createApp, db, rawLogin, resetDb } from './helpers';

// في الملف ده بس: حد صغير لمحاولات الدخول عشان نجرب الحماية من التخمين
process.env.THROTTLE_LOGIN_PER_MINUTE = '3';

const prisma = db();
let app: INestApplication;

beforeAll(async () => {
  await resetDb(prisma);
  app = await createApp();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

it('slows down anyone guessing passwords from the same device', async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 5; i++) statuses.push((await rawLogin(app, `guess${i}`, 'x').req).status);
  expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
  expect(statuses.slice(3)).toEqual([429, 429]);
});
