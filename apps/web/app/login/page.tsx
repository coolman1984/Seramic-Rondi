'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { CodeForm, MfaSetupBody, useSubmit } from '@/components/auth-forms';
import { api, ApiError } from '@/lib/api';
import { fetchMe, useSetMe, type Me } from '@/lib/auth';
import { Logo } from '@/components/logo';
import { Alert, Button, Field, Input, Spinner } from '@/components/ui';

/** بيمنع التحويل لموقع برا بعد الدخول (?next=https://evil) */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const setMe = useSetMe();
  const [me, setLocalMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);

  // لو داخل من قبل ولسه في خطوة (رمز إضافي/تغيير كلمة السر) نكمّل منها
  useEffect(() => {
    fetchMe()
      .then((m) => {
        if (m.stage === 'active') router.replace(safeNext(params.get('next')));
        else setLocalMe(m);
      })
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, [params, router]);

  const advance = async () => {
    const m = await fetchMe();
    setMe(m);
    if (m.stage === 'active') router.replace(safeNext(params.get('next')));
    else setLocalMe(m);
  };

  const stage = me?.stage ?? 'login';

  return (
    <main className="min-h-dvh px-3 py-3 sm:px-4 sm:py-4">
      <div className="sky flex min-h-[calc(100dvh-24px)] flex-col items-center rounded-[22px] border border-line px-4 pt-10 pb-10 sm:pt-16">
        <Logo className="mb-10" />
        <p className="mb-3 text-[13px] text-muted">
          نظام إدارة مصنع <b className="font-serif text-[15px] font-medium text-ink-2">السيراميك والبورسلين</b>
        </p>
        <h1 className="mb-3 max-w-[15em] text-center font-serif text-[clamp(28px,5vw,44px)] leading-[1.35] font-normal">
          {stage === 'login' && 'أهلاً بيك، سجّل دخولك'}
          {stage === 'mfa_verify' && 'خطوة أمان أخيرة'}
          {stage === 'password_change' && 'اختار كلمة سر جديدة'}
          {stage === 'mfa_setup' && 'فعّل الرمز الإضافي'}
        </h1>
        <p className="mb-8 max-w-md text-center text-[15px] text-muted">
          {stage === 'login' && 'اكتب اسم الدخول وكلمة السر اللي أخدتهم من مدير النظام.'}
          {stage === 'mfa_verify' && 'افتح تطبيق الرمز على موبايلك واكتب الـ ٦ أرقام اللي ظاهرين.'}
          {stage === 'password_change' && 'لازم تغير كلمة السر المؤقتة قبل ما تبدأ. محدش غيرك هيعرفها.'}
          {stage === 'mfa_setup' && 'دورك في النظام محتاج حماية زيادة: رمز بيتغير كل ٣٠ ثانية على موبايلك.'}
        </p>

        <div className="w-full max-w-[400px] rounded-2xl border border-line bg-panel/95 p-6 shadow-soft backdrop-blur">
          {checking ? (
            <Spinner label="لحظة…" />
          ) : stage === 'login' ? (
            <LoginForm onDone={advance} />
          ) : stage === 'mfa_verify' ? (
            <CodeForm endpoint="/auth/mfa/verify" onDone={advance} />
          ) : stage === 'password_change' ? (
            <PasswordForm onDone={advance} />
          ) : (
            <MfaSetup onDone={advance} />
          )}
        </div>

        {stage !== 'login' && !checking && (
          <button
            type="button"
            className="mt-5 text-[13px] text-muted underline-offset-4 hover:underline"
            onClick={async () => {
              await api.post('/auth/logout').catch(() => undefined);
              setMe(null);
              setLocalMe(null);
            }}
          >
            خروج والدخول بحساب تاني
          </button>
        )}
        <p className="mt-auto pt-12 text-[11.5px] text-muted">كل عمليات الدخول بتتسجل. بعد ٥ محاولات غلط الحساب بيتقفل ربع ساعة.</p>
      </div>
    </main>
  );
}

function LoginForm({ onDone }: { onDone: () => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, submit } = useSubmit(async () => {
    await api.post('/auth/login', { username, password });
    await onDone();
  });
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="اسم الدخول" htmlFor="username">
        <Input id="username" name="username" autoComplete="username" dir="ltr" className="text-left" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
      </Field>
      <Field label="كلمة السر" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" dir="ltr" className="text-left" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!username || !password}>
        <KeyRound className="size-4" /> دخول
      </Button>
    </form>
  );
}

function PasswordForm({ onDone }: { onDone: () => Promise<void> }) {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const { busy, error, fields, submit } = useSubmit(async () => {
    if (newPassword !== confirm) {
      setMismatch(true);
      throw new ApiError(400, 'VALIDATION', 'كلمة السر الجديدة وتأكيدها مش زي بعض');
    }
    setMismatch(false);
    await api.post('/auth/change-password', { currentPassword, newPassword });
    await onDone();
  });
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="كلمة السر الحالية" htmlFor="current" error={fields.currentPassword}>
        <Input id="current" type="password" autoComplete="current-password" dir="ltr" className="text-left" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} invalid={!!fields.currentPassword} autoFocus />
      </Field>
      <Field label="كلمة السر الجديدة" htmlFor="new" error={fields.newPassword} hint="٨ حروف أو أرقام على الأقل، ومتكونش سهلة زي 12345678">
        <Input id="new" type="password" autoComplete="new-password" dir="ltr" className="text-left" value={newPassword} onChange={(e) => setNew(e.target.value)} invalid={!!fields.newPassword} />
      </Field>
      <Field label="اكتبها تاني للتأكيد" htmlFor="confirm" error={mismatch ? 'مش زي اللي فوق' : undefined}>
        <Input id="confirm" type="password" autoComplete="new-password" dir="ltr" className="text-left" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={mismatch} />
      </Field>
      {error && !fields.newPassword && !fields.currentPassword && <Alert>{error}</Alert>}
      <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!currentPassword || !newPassword || !confirm}>
        حفظ كلمة السر
      </Button>
    </form>
  );
}

function MfaSetup({ onDone }: { onDone: () => Promise<void> }) {
  const [data, setData] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .post<{ qrDataUrl: string; secret: string }>('/auth/mfa/setup')
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'حصلت مشكلة'));
  }, []);
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;
  return <MfaSetupBody data={data} onDone={onDone} />;
}

