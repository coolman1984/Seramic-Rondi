import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * كلمات السر بتتحفظ بطريقة argon2id (الموصى بيها عالمياً): بصمة متقدرش ترجع لكلمة السر،
 * وتقيلة عن قصد عشان محاولة تخمين ملايين الكلمات تبقى بطيئة جداً.
 */
const OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordService {
  // بصمة وهمية بنتحقق منها لما اسم الدخول مايكونش موجود، عشان وقت الرد يبقى واحد
  // ومحدش يعرف من الوقت إذا كان الاسم موجود ولا لأ.
  private dummyHash: Promise<string> | null = null;

  hash(password: string): Promise<string> {
    return argon2.hash(password, OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, OPTIONS);
  }

  async burn(password: string): Promise<void> {
    this.dummyHash ??= this.hash('rondi-dummy-password-for-timing');
    await this.verify(await this.dummyHash, password);
  }
}
