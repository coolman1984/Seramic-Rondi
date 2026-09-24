'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { ToastProvider } from './toast';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // مايعيدش المحاولة لو المشكلة صلاحيات أو بيانات غلط، بس يعيد لو النت فصل
            retry: (count, err) => err instanceof ApiError && err.status === 0 && count < 3,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    // تطبيق يتثبت على الموبايل ويفتح الشاشات حتى لو النت ضعيف
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => undefined);
    }
  }, []);

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
