import { execSync } from 'node:child_process';
import { Client } from 'pg';

/** قبل الاختبارات: قاعدة بيانات الاختبار بتتمسح وتتبني من الأول بنفس ملفات الترحيل الحقيقية. */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://rondi:rondi_dev_pw@localhost:5432/rondi_test';
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await client.end();
  execSync('npx prisma migrate deploy', {
    cwd: __dirname + '/..',
    env: { ...process.env, DATABASE_URL: url, DATABASE_MIGRATE_URL: url },
    stdio: 'pipe',
  });
}
