'use client';

import { useState, type FormEvent } from 'react';
import { ShieldCheck, Smartphone } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Alert, Button, Field, Input } from './ui';

export function useSubmit(fn: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields);
      } else setError('حصلت مشكلة. جرب تاني.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, fields, submit };
}

export function CodeForm({ endpoint, onDone, label = 'الرمز' }: { endpoint: string; onDone: () => Promise<void>; label?: string }) {
  const [code, setCode] = useState('');
  const { busy, error, submit } = useSubmit(async () => {
    await api.post(endpoint, { code });
    await onDone();
  });
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label={label} htmlFor="code" hint="٦ أرقام — ممكن تكتبهم بالعربي أو بالإنجليزي">
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" className="text-center text-[22px] tracking-[0.4em]" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
      </Field>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" variant="primary" size="lg" loading={busy} disabled={code.replace(/\s/g, '').length < 6}>
        <ShieldCheck className="size-4" /> تأكيد
      </Button>
    </form>
  );
}

export function MfaSetupBody({ data, onDone }: { data: { qrDataUrl: string; secret: string }; onDone: () => Promise<void> }) {
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2 text-[13.5px] text-ink-2">
        <li className="flex gap-2">
          <Smartphone className="mt-1 size-4 shrink-0 text-accent" /> نزّل تطبيق Google Authenticator أو Microsoft Authenticator على موبايلك.
        </li>
        <li>امسح المربع ده من جوه التطبيق:</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.qrDataUrl} alt="رمز التفعيل" width={180} height={180} className="mx-auto rounded-lg bg-white p-2" />
      <details className="text-[12.5px] text-muted">
        <summary className="cursor-pointer">مش قادر تمسح؟ اكتب الكود ده بإيدك</summary>
        <code dir="ltr" className="mt-2 block rounded-lg bg-card p-2 text-center font-mono text-[13px] tracking-wider break-all text-ink select-all">
          {data.secret}
        </code>
      </details>
      <CodeForm endpoint="/auth/mfa/enable" onDone={onDone} label="اكتب الرمز اللي ظهر في التطبيق" />
    </div>
  );
}
