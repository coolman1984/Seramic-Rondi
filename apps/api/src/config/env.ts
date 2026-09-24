import { z } from 'zod';

/**
 * كل الإعدادات والأسرار بتيجي من متغيرات البيئة (ملف .env على السيرفر)،
 * ومفيش ولا سر مكتوب جوه الكود. لو حاجة ناقصة، البرنامج مش هيشتغل أصلاً.
 */
const boolish = z.preprocess((v) => (v === 'true' || v === '1' ? true : v === 'false' || v === '0' ? false : v), z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1).startsWith('postgres'),
  APP_ORIGIN: z.url(),
  COOKIE_SECURE: boolish.default(true),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  DATA_ENCRYPTION_KEY: z
    .string()
    .refine((k) => Buffer.from(k, 'base64').length === 32, 'DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded'),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().min(1).max(72).default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().min(5).max(24 * 60).default(120),
  SESSION_MAX_PER_USER: z.coerce.number().int().min(1).max(20).default(5),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(24 * 60).default(15),
  THROTTLE_LIMIT_PER_MINUTE: z.coerce.number().int().min(10).default(300),
  THROTTLE_LOGIN_PER_MINUTE: z.coerce.number().int().min(1).default(10),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
    throw new Error('COOKIE_SECURE must be true in production');
  }
  return env;
}

export function env(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}

/** للاختبارات بس */
export function resetEnvCache() {
  cached = null;
}
