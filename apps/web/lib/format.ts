/** عرض الأرقام والتواريخ بالعربي (أرقام ٠١٢٣) وبتوقيت القاهرة. */
const TZ = 'Africa/Cairo';

export function num(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: digits }).format(value);
}

/** الأكواد (زي ب3 أو 6060) بتظهر بأرقام عربي. */
export function arDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ar-EG', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function relative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('ar-EG', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}
