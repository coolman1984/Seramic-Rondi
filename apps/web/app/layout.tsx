import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import '@fontsource/ibm-plex-sans-arabic/300.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/noto-naskh-arabic/400.css';
import '@fontsource/noto-naskh-arabic/500.css';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: { default: 'روندي', template: '%s · روندي' },
  description: 'نظام إدارة مصنع السيراميك والبورسلين',
  applicationName: 'روندي',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef0f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0c0f' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // كل صفحة بتترسم لكل طلب، عشان رمز الحماية (nonce) يتغير كل مرة
  await connection();
  return (
    <html lang="ar" dir="rtl">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
