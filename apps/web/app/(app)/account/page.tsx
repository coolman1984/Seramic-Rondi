'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, ShieldCheck, Smartphone } from 'lucide-react';
import { changePasswordSchema } from '@rondi/shared';
import { api, ApiError } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { relative } from '@/lib/format';
import { MfaSetupBody } from '@/components/auth-forms';
import { FormError, useRecordForm } from '@/components/record-form';
import { useToast } from '@/components/toast';
import { Alert, Button, Chip, Field, Input, PageHeader, Spinner } from '@/components/ui';

interface SessionRow {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

function deviceName(ua: string | null) {
  if (!ua) return 'جهاز غير معروف';
  if (/iPhone|Android.*Mobile/i.test(ua)) return 'موبايل';
  if (/iPad|Android|Tablet/i.test(ua)) return 'تابلت';
  return 'كمبيوتر';
}

export default function AccountPage() {
  const { data: me } = useMe();
  if (!me) return <Spinner />;
  return (
    <>
      <PageHeader eyebrow="حسابي" title={me.user.fullName} dim={`· ${me.user.role.name}`} sub={`اسم الدخول: ${me.user.username}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <PasswordCard />
        <MfaCard />
        <div className="lg:col-span-2">
          <SessionsCard />
        </div>
      </div>
    </>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 sm:p-6">
      <h2 className="font-serif text-[20px] font-normal">{title}</h2>
      {sub && <p className="mt-1 mb-5 text-[13.5px] text-muted">{sub}</p>}
      {children}
    </section>
  );
}

function PasswordCard() {
  const toast = useToast();
  const form = useRecordForm({ currentPassword: '', newPassword: '' });
  const save = () =>
    form.run(changePasswordSchema, async (data) => {
      await api.post('/auth/change-password', data);
      form.setValues({ currentPassword: '', newPassword: '' });
      toast('ok', 'اتغيرت كلمة السر. أي جهاز تاني كان داخل بحسابك خرج.');
    });
  return (
    <Section title="كلمة السر" sub="غيّرها لو حسيت إن حد عرفها. كل الأجهزة التانية هتخرج.">
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex flex-col gap-4" noValidate>
        <Field label="كلمة السر الحالية" htmlFor="cp" error={form.fields.currentPassword}>
          <Input id="cp" type="password" autoComplete="current-password" dir="ltr" className="text-left" value={String(form.values.currentPassword)} onChange={(e) => form.set('currentPassword', e.target.value)} invalid={!!form.fields.currentPassword} />
        </Field>
        <Field label="كلمة السر الجديدة" htmlFor="npw" error={form.fields.newPassword} hint="٨ حروف أو أرقام على الأقل">
          <Input id="npw" type="password" autoComplete="new-password" dir="ltr" className="text-left" value={String(form.values.newPassword)} onChange={(e) => form.set('newPassword', e.target.value)} invalid={!!form.fields.newPassword} />
        </Field>
        <FormError error={form.error} fields={form.fields} />
        <div>
          <Button type="submit" variant="primary" loading={form.busy}>تغيير كلمة السر</Button>
        </div>
      </form>
    </Section>
  );
}

function MfaCard() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!me) return null;

  const start = async () => {
    setError(null);
    try {
      setSetup(await api.post('/auth/mfa/setup'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'حصلت مشكلة');
    }
  };
  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/mfa/disable', { password });
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast('ok', 'اتلغى الرمز الإضافي');
      setPassword('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'حصلت مشكلة');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="الرمز الإضافي" sub="حماية زيادة: حتى لو حد عرف كلمة السر، مش هيدخل من غير موبايلك.">
      {me.mfaEnabled ? (
        <div className="flex flex-col gap-4">
          <Alert tone="ok">
            <span className="flex items-center gap-2"><ShieldCheck className="size-4" /> متفعّل على حسابك.</span>
          </Alert>
          {me.mfaRequired ? (
            <p className="text-[13px] text-muted">دورك محتاج الرمز ده دايماً. لو موبايلك ضاع، كلّم مدير النظام يلغيه وتفعّله تاني.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <Field label="اكتب كلمة السر عشان تلغيه" htmlFor="mp">
                <Input id="mp" type="password" dir="ltr" className="text-left" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <div>
                <Button variant="danger" loading={busy} disabled={!password} onClick={disable}>إلغاء الرمز الإضافي</Button>
              </div>
            </div>
          )}
        </div>
      ) : setup ? (
        <MfaSetupBody
          data={setup}
          onDone={async () => {
            await qc.invalidateQueries({ queryKey: ['me'] });
            setSetup(null);
            toast('ok', 'اتفعّل الرمز الإضافي');
          }}
        />
      ) : (
        <Button variant="primary" onClick={start}>
          <Smartphone className="size-4" /> تفعيل الرمز الإضافي
        </Button>
      )}
      {error && <div className="mt-3"><Alert>{error}</Alert></div>}
    </Section>
  );
}

function SessionsCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['sessions'], queryFn: () => api.get<SessionRow[]>('/auth/sessions') });
  const revoke = async (id: string) => {
    await api.post(`/auth/sessions/${id}/revoke`);
    await qc.invalidateQueries({ queryKey: ['sessions'] });
    toast('ok', 'الجهاز ده خرج من حسابك');
  };
  return (
    <Section title="الأجهزة الداخلة بحسابك" sub="لو في جهاز مش عارفه، اقفله وغيّر كلمة السر.">
      {isLoading ? (
        <Spinner />
      ) : (
        <ul className="flex flex-col gap-2">
          {data?.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3">
              {deviceName(s.userAgent) === 'موبايل' ? <Smartphone className="size-5 text-muted" /> : <Laptop className="size-5 text-muted" />}
              <span className="flex flex-col">
                <span className="text-[14px] font-medium">
                  {deviceName(s.userAgent)} {s.current && <Chip tone="blue">الجهاز ده</Chip>}
                </span>
                <span className="text-[12px] text-muted">
                  آخر استخدام {relative(s.lastSeenAt)} · <span dir="ltr">{s.ip ?? ''}</span>
                </span>
              </span>
              {!s.current && (
                <Button size="sm" variant="danger" className="ms-auto" onClick={() => revoke(s.id)}>
                  قفل
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
