import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';

/**
 * تشفير البيانات الحساسة (أرقام الموبايل، سر الرمز الإضافي) قبل ما تتخزن.
 * AES-256-GCM: لو حد عدّل في النص المتشفر، فك التشفير بيفشل.
 * الشكل المتخزن: v1.<iv>.<tag>.<data> (base64url)
 */
const VERSION = 'v1';

function key(): Buffer {
  return Buffer.from(env().DATA_ENCRYPTION_KEY, 'base64');
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), data.toString('base64url')].join('.');
}

export function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== VERSION || !iv || !tag || data === undefined) throw new Error('Unsupported ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

export function encryptNullable(v: string | null | undefined): string | null {
  return v ? encrypt(v) : null;
}

export function decryptNullable(v: string | null | undefined): string | null {
  return v ? decrypt(v) : null;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** "01001234567" → "010•••••567" للعرض في السجل من غير ما الرقم كله يبان */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.length <= 6) return '•'.repeat(phone.length);
  return phone.slice(0, 3) + '•'.repeat(phone.length - 6) + phone.slice(-3);
}
