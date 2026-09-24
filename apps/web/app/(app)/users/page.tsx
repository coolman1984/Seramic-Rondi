'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Lock, Plus, ShieldOff, UserPlus } from 'lucide-react';
import { resetPasswordSchema, userCreateSchema, userUpdateSchema } from '@rondi/shared';
import { api, qs, type Page } from '@/lib/api';
import { useCan, useMe } from '@/lib/auth';
import { dateTime, relative } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import { DataList, Pager, SearchBar, type Column } from '@/components/data-list';
import { FormError, useRecordForm } from '@/components/record-form';
import { useToast } from '@/components/toast';
import { Alert, Button, Checkbox, Chip, Dialog, Empty, Field, Input, PageHeader, Select, Spinner } from '@/components/ui';

interface UserRow {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
  role: { id: string; code: string; name: string };
  isActive: boolean;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  locked: boolean;
  lastLoginAt: string | null;
  version: number;
}

interface RoleRow {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

const columns: Column<UserRow>[] = [
  { key: 'fullName', label: 'الاسم', render: (u) => u.fullName, primary: true },
  { key: 'username', label: 'اسم الدخول', render: (u) => <code dir="ltr">{u.username}</code> },
  { key: 'role', label: 'الدور', render: (u) => u.role.name },
  { key: 'last', label: 'آخر دخول', render: (u) => (u.lastLoginAt ? relative(u.lastLoginAt) : 'لسه مادخلش') },
];

function statusOf(u: UserRow) {
  if (!u.isActive) return <Chip>متوقف</Chip>;
  if (u.locked) return <Chip tone="bad">مقفول مؤقتاً</Chip>;
  if (u.mustChangePassword) return <Chip tone="warn">مستني يغير كلمة السر</Chip>;
  return <Chip tone="ok">شغال</Chip>;
}

export default function UsersPage() {
  const can = useCan();
  const canManage = can('users.manage');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [inactive, setInactive] = useState(false);
  const [open, setOpen] = useState<UserRow | 'new' | null>(null);
  const search = useDebounced(q);

  const list = useQuery({
    queryKey: ['users', search, page, inactive],
    queryFn: () => api.get<Page<UserRow>>(`/users${qs({ q: search, page, includeInactive: inactive })}`),
  });
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api.get<RoleRow[]>('/roles') });

  return (
    <>
      <PageHeader
        eyebrow="المستخدمين"
        title="كل واحد بحسابه،"
        dim="ومحدش بيشارك كلمة سره."
        sub="الحساب الجديد بيدخل بكلمة سر مؤقتة ولازم يغيرها أول مرة. الحسابات مابتتمسحش، بتتوقف بس، عشان سجل العمليات يفضل كامل."
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setOpen('new')}>
              <UserPlus className="size-4" /> مستخدم جديد
            </Button>
          )
        }
      />
      <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="دوّر بالاسم أو اسم الدخول…">
        <Checkbox label="إظهار المتوقف" checked={inactive} onChange={(v) => { setInactive(v); setPage(1); }} />
      </SearchBar>
      {list.isLoading ? (
        <Spinner />
      ) : list.data?.rows.length ? (
        <>
          <DataList rows={list.data.rows} columns={columns} onOpen={canManage ? setOpen : undefined} status={statusOf} />
          <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
        </>
      ) : (
        <Empty title="مفيش نتايج" />
      )}
      {open && roles.data && <UserDialog user={open === 'new' ? null : open} roles={roles.data.filter((r) => r.isActive)} onClose={() => setOpen(null)} />}
    </>
  );
}

function UserDialog({ user, roles, onClose }: { user: UserRow | null; roles: RoleRow[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: me } = useMe();
  const [panel, setPanel] = useState<'main' | 'password'>('main');
  const initial = useMemo(
    () => (user ? { fullName: user.fullName, phone: user.phone ?? '', roleId: user.role.id } : { username: '', fullName: '', phone: '', roleId: '', password: '' }),
    [user],
  );
  const form = useRecordForm(initial);
  const pw = useRecordForm({ newPassword: '' });

  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });

  const save = () =>
    form.run(user ? userUpdateSchema : userCreateSchema, async (data) => {
      if (user) await api.patch(`/users/${user.id}`, { ...data, version: user.version });
      else await api.post('/users', data);
      await refresh();
      toast('ok', user ? 'اتحفظ التعديل' : 'اتعمل الحساب. ادّي كلمة السر المؤقتة للموظف بإيدك.');
      onClose();
    });

  const action = async (path: string, body: object | undefined, message: string) => {
    try {
      await api.post(`/users/${user!.id}/${path}`, body);
      await refresh();
      toast('ok', message);
      onClose();
    } catch (e) {
      form.setError(e instanceof Error ? e.message : 'حصلت مشكلة');
    }
  };

  const isSelf = user?.id === me?.user.id;

  if (panel === 'password' && user) {
    return (
      <Dialog
        open
        onClose={onClose}
        title={`كلمة سر جديدة لـ ${user.fullName}`}
        footer={
          <>
            <Button
              variant="primary"
              loading={pw.busy}
              onClick={() =>
                pw.run(resetPasswordSchema, async (data) => {
                  await api.post(`/users/${user.id}/reset-password`, data);
                  await refresh();
                  toast('ok', 'اتغيرت كلمة السر. هيطلب منه يغيرها أول ما يدخل.');
                  onClose();
                })
              }
            >
              حفظ كلمة السر
            </Button>
            <Button onClick={() => setPanel('main')}>رجوع</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert tone="warn">كل الأجهزة اللي داخل منها هتخرج، وأول ما يدخل لازم يختار كلمة سر جديدة بنفسه.</Alert>
          <Field label="كلمة السر المؤقتة" htmlFor="np" error={pw.fields.newPassword}>
            <Input id="np" dir="ltr" className="text-left" value={String(pw.values.newPassword)} onChange={(e) => pw.set('newPassword', e.target.value)} invalid={!!pw.fields.newPassword} autoComplete="off" />
          </Field>
          <FormError error={pw.error} fields={pw.fields} />
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={user ? user.fullName : 'مستخدم جديد'}
      footer={
        <>
          <Button variant="primary" loading={form.busy} onClick={save}>
            {user ? 'حفظ' : <><Plus className="size-4" /> إنشاء الحساب</>}
          </Button>
          <Button onClick={onClose}>إلغاء</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex flex-col gap-4" noValidate>
        {!user && (
          <Field label="اسم الدخول" htmlFor="u" error={form.fields.username} hint="حروف إنجليزي صغيرة وأرقام، زي sup.a أو ahmed.store">
            <Input id="u" dir="ltr" className="text-left" autoCapitalize="none" spellCheck={false} value={String(form.values.username)} onChange={(e) => form.set('username', e.target.value)} invalid={!!form.fields.username} />
          </Field>
        )}
        <Field label="الاسم بالكامل" htmlFor="n" error={form.fields.fullName} required>
          <Input id="n" value={String(form.values.fullName)} onChange={(e) => form.set('fullName', e.target.value)} invalid={!!form.fields.fullName} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الدور" htmlFor="r" error={form.fields.roleId} required>
            <Select id="r" value={String(form.values.roleId)} onChange={(e) => form.set('roleId', e.target.value)} invalid={!!form.fields.roleId} disabled={isSelf}>
              <option value="">اختار…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الموبايل" htmlFor="p" error={form.fields.phone} hint="اختياري — بيتخزن متشفر">
            <Input id="p" inputMode="tel" dir="ltr" className="text-left" value={String(form.values.phone ?? '')} onChange={(e) => form.set('phone', e.target.value)} invalid={!!form.fields.phone} />
          </Field>
        </div>
        {!user && (
          <Field label="كلمة سر مؤقتة" htmlFor="pw" error={form.fields.password} hint="هيغيرها بنفسه أول ما يدخل">
            <Input id="pw" dir="ltr" className="text-left" autoComplete="off" value={String(form.values.password)} onChange={(e) => form.set('password', e.target.value)} invalid={!!form.fields.password} />
          </Field>
        )}
        <FormError error={form.error} fields={form.fields} />
        <button type="submit" hidden />
      </form>

      {user && (
        <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5">
          <p className="text-[12.5px] text-muted">
            آخر دخول: <span className="tabular">{dateTime(user.lastLoginAt)}</span> · الرمز الإضافي: {user.mfaEnabled ? 'متفعّل' : 'مش متفعّل'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setPanel('password')}>
              <KeyRound className="size-4" /> كلمة سر جديدة
            </Button>
            {user.locked && (
              <Button size="sm" onClick={() => action('unlock', undefined, 'اتفك القفل')}>
                <Lock className="size-4" /> فك القفل
              </Button>
            )}
            {user.mfaEnabled && (
              <Button size="sm" onClick={() => action('reset-mfa', undefined, 'اتلغى الرمز الإضافي. هيفعّله تاني أول ما يدخل لو دوره محتاجه.')}>
                <ShieldOff className="size-4" /> إلغاء الرمز الإضافي (موبايل ضاع)
              </Button>
            )}
            {!isSelf && (
              <Button
                size="sm"
                variant={user.isActive ? 'danger' : 'secondary'}
                onClick={() => action(user.isActive ? 'deactivate' : 'activate', { version: user.version }, user.isActive ? 'اتوقف الحساب وخرج من كل الأجهزة' : 'الحساب اتفعّل تاني')}
              >
                {user.isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
