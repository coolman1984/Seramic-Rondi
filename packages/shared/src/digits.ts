/**
 * العمال بيكتبوا الأرقام بالعربي (٠١٢٣) أو بالإنجليزي (0123) — الاتنين لازم يتقبلوا.
 * بنحوّل أي رقم عربي/فارسي لرقم عادي، والفاصلة العشرية العربية (٫) لنقطة،
 * ونشيل فاصل الآلاف (٬ أو ,).
 */
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const a = ARABIC_INDIC.indexOf(ch);
    if (a >= 0) { out += String(a); continue; }
    const p = PERSIAN.indexOf(ch);
    if (p >= 0) { out += String(p); continue; }
    out += ch;
  }
  return out;
}

/** Parses a user-typed number ("١٬٢٥٠٫٥" or "1,250.5") into a JS number, or NaN. */
export function parseLooseNumber(input: string): number {
  const s = normalizeDigits(input).trim().replace(/[٬,\s]/g, '').replace('٫', '.');
  if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}
