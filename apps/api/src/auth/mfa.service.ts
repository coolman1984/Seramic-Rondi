import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';
import * as QRCode from 'qrcode';

/** الرمز الإضافي (٦ أرقام بتتغير كل ٣٠ ثانية) من تطبيق على الموبايل زي Google Authenticator. */
@Injectable()
export class MfaService {
  newSecret(): string {
    return generateSecret();
  }

  async enrollment(secret: string, username: string) {
    const uri = generateURI({ issuer: 'Rondi', label: username, secret });
    const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    return { uri, qrDataUrl, secret };
  }

  /** بيرجّع رقم الخطوة الزمنية لو الرمز صح، عشان نمنع استخدام نفس الرمز مرتين. */
  async check(secret: string, code: string, lastStep: bigint | null): Promise<bigint | null> {
    const result = await verify({ secret, token: code, epochTolerance: 30 });
    if (!result.valid) return null;
    if (!('timeStep' in result)) return null;
    const step = BigInt(result.timeStep as number);
    if (lastStep !== null && step <= lastStep) return null;
    return step;
  }
}
