import { config as loadDotenv } from 'dotenv';
loadDotenv({ quiet: true });
import { defineConfig } from 'prisma/config';

// الترحيل (تعديل شكل الجداول) بيتعمل بمستخدم صاحب القاعدة،
// والتطبيق نفسه بيشتغل بمستخدم صلاحياته أقل (شوف docker/postgres-init.sql).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node -r @swc-node/register prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_MIGRATE_URL ?? process.env.DATABASE_URL ?? '',
  },
});
