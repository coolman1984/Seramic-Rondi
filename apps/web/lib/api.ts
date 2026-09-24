/**
 * كل كلام الشاشات مع الخادم بيعدي من هنا:
 * - بيبعت الكوكي تلقائياً (نفس الموقع)
 * - بيبعت رمز الحماية (CSRF) مع أي طلب بيغيّر حاجة
 * - بيحوّل أخطاء الخادم لرسايل عربي واضحة، وأخطاء كل خانة لوحدها
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;
export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

type Method = 'GET' | 'POST' | 'PATCH';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'rondi' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'OFFLINE', 'مفيش اتصال بالسيرفر. اتأكد من الشبكة وجرب تاني.');
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { code = 'ERROR', message = 'حصلت مشكلة. جرب تاني.', fields = {}, ...extra } = data ?? {};
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/login')) {
      const next = window.location.pathname + window.location.search;
      if (!window.location.pathname.startsWith('/login')) window.location.href = `/login?next=${encodeURIComponent(next)}`;
    }
    throw new ApiError(res.status, code, message, fields, extra);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
};

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
}

export interface Page<T> {
  total: number;
  page: number;
  pageSize: number;
  rows: T[];
}
