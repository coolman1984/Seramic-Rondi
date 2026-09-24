/*
 * عامل الخدمة: بيحفظ ملفات الشاشات (مش البيانات) عشان التطبيق يفتح بسرعة ويشتغل مع النت الضعيف.
 * بيانات المصنع (/api) عمرها ما بتتحفظ هنا — دايماً من السيرفر.
 * (تسجيل الإنتاج من غير نت بالكامل جاي في المرحلة ٢)
 */
const CACHE = 'rondi-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // ملفات ثابتة (خطوط، أكواد، صور): من الكاش الأول
  if (url.pathname.startsWith('/_next/static/') || /\.(woff2?|svg|png)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
