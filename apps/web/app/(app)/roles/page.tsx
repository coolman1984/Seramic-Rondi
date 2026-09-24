'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { MODULES, PERMISSIONS, roleCreateSchema, type Permission } from '@rondi/shared';
import { api, ApiError } from '@/lib/api';
import { useCan } from '@/lib/auth';
import { num } from '@/lib/format';
import { FormError, useRecordForm } from '@/components/record-form';
import { useToast } from '@/components/toast';
import { Alert, Button, Checkbox, Chip, cx, Dialog, Eyebrow, Field, Input, PageHeader, Spinner } from '@/components/ui';

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  mfaRequired: boolean;
  permissions: Permission[];
  activeUsers: number;
  version: number;
}

const ADMIN_PERMS: Permission[] = ['users.read', 'users.manage', 'roles.manage', 'audit.read', 'masterdata.read', 'masterdata.manage', 'dashboard.read'];

function level(perms: Permission[], mod: string): 'f' | 'v' | 'n' {
  if (perms.includes(`${mod}.write` as Permission)) return 'f';
  if (perms.includes(`${mod}.read` as Permission)) return 'v';
  return 'n';
}

function LevelDot({ l }: { l: 'f' | 'v' | 'n' }) {
  const label = { f: 'تسجيل وتعديل', v: 'عرض بس', n: 'مش ظاهر' }[l];
  return (
    <span
      title={label}
      aria-label={label}
      className={cx(
        'inline-block size-3 rounded-full align-middle',
        l === 'f' && 'bg-accent',
        l === 'v' && 'border-[1.5px] border-accent bg-[linear-gradient(90deg,transparent_50%,var(--accent)_50%)]',
        l === 'n' && 'border-[1.5px] border-faint',
      )}
    />
  );
}

export default function RolesPage() {
  const can = useCan();
  const canManage = can('roles.manage');
  const { data: roles, isLoading } = useQuery({ queryKey: ['roles'], queryFn: () => api.get<RoleRow[]>('/roles') });
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const role = roles?.find((r) => r.id === selected) ?? null;

  return (
    <>
      <PageHeader
        eyebrow="الأدوار والصلاحيات"
        title="كل واحد يشوف اللي يخصه،"
        dim="ويعمل اللي يخصه بس."
        sub="التغيير هنا بيشتغل فوراً، والخادم هو اللي بيمنع — مش بس إخفاء زرار. دوس على أي دور عشان تشوف تفاصيله."
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> دور جديد
            </Button>
          )
        }
      />
      {isLoading || !roles ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-muted">
                  <th className="px-4 py-3 text-right font-medium">الدور</th>
                  {MODULES.map((m) => (
                    <th key={m.key} className="px-2 py-3 text-center leading-5 font-medium">
                      {m.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-medium">مستخدمين</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    onClick={() => setSelected(r.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(r.id)}
                    className={cx('cursor-pointer border-b border-line last:border-0 hover:bg-card', selected === r.id && 'bg-accent-soft/60')}
                  >
                    <th scope="row" className="px-4 py-3 text-right font-medium whitespace-nowrap">
                      {r.name}
                      {r.mfaRequired && <span className="ms-2 align-middle"><Chip tone="blue">رمز إضافي</Chip></span>}
                    </th>
                    {MODULES.map((m) => (
                      <td key={m.key} className="px-2 py-3 text-center">
                        <LevelDot l={level(r.permissions, m.key)} />
                      </td>
                    ))}
                    <td className="tabular px-3 py-3 text-center text-muted">{num(r.activeUsers)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-5 text-[12.5px] text-muted">
            <span className="flex items-center gap-1.5"><LevelDot l="f" /> تسجيل وتعديل</span>
            <span className="flex items-center gap-1.5"><LevelDot l="v" /> عرض بس</span>
            <span className="flex items-center gap-1.5"><LevelDot l="n" /> مش ظاهر</span>
          </div>
        </>
      )}
      {role && <RoleDialog key={role.id + role.version} role={role} canManage={canManage} onClose={() => setSelected(null)} />}
      {creating && <CreateRole onClose={() => setCreating(false)} />}
    </>
  );
}

function RoleDialog({ role, canManage, onClose }: { role: RoleRow; canManage: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [perms, setPerms] = useState<Set<Permission>>(new Set(role.permissions));
  const [mfa, setMfa] = useState(role.mfaRequired);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setPerms(new Set(role.permissions)), [role]);

  const toggle = (p: Permission, on: boolean) =>
    setPerms((prev) => {
      const next = new Set(prev);
      if (on) next.add(p);
      else next.delete(p);
      // التعديل من غير عرض مالوش معنى
      const [mod, action] = p.split('.');
      if (on && (action === 'write' || action === 'manage' || action === 'report')) next.add(`${mod}.read` as Permission);
      if (!on && action === 'read') {
        next.delete(`${mod}.write` as Permission);
        next.delete(`${mod}.manage` as Permission);
        next.delete(`${mod}.report` as Permission);
      }
      return next;
    });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/roles/${role.id}`, { permissions: [...perms], mfaRequired: mfa, version: role.version });
      await qc.invalidateQueries({ queryKey: ['roles'] });
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast('ok', 'اتحفظت الصلاحيات، وبتشتغل من دلوقتي');
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'حصلت مشكلة');
    } finally {
      setBusy(false);
    }
  };

  const box = (p: Permission, label?: string) => (
    <Checkbox key={p} label={label ?? PERMISSIONS[p]} checked={perms.has(p)} onChange={(v) => toggle(p, v)} disabled={!canManage} />
  );

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={role.name}
      footer={
        canManage ? (
          <>
            <Button variant="primary" loading={busy} onClick={save}>حفظ الصلاحيات</Button>
            <Button onClick={onClose}>إلغاء</Button>
          </>
        ) : (
          <Button onClick={onClose}>إغلاق</Button>
        )
      }
    >
      <div className="flex flex-col gap-6">
        {role.description && <p className="text-[14px] text-muted">{role.description}</p>}
        {role.code === 'SYSTEM_ADMIN' && <Alert tone="blue">دور مدير النظام لازم يفضل يقدر يدير المستخدمين والصلاحيات ويشوف السجل، عشان النظام مايتقفلش على الكل.</Alert>}
        <section>
          <Eyebrow>الإدارة</Eyebrow>
          <div className="grid gap-2.5 sm:grid-cols-2">{ADMIN_PERMS.map((p) => box(p))}</div>
        </section>
        <section>
          <Eyebrow>أنظمة المصنع</Eyebrow>
          <div className="grid gap-2 rounded-xl border border-line p-3">
            {MODULES.map((m) => (
              <div key={m.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line py-1.5 last:border-0 sm:grid-cols-[12em_auto_auto_auto]">
                <span className="text-[14px] font-medium">{m.label}</span>
                {box(`${m.key}.read` as Permission, 'عرض')}
                {box(`${m.key}.write` as Permission, 'تسجيل')}
                {m.key === 'maintenance' && box('maintenance.report', 'تبليغ عطل')}
              </div>
            ))}
          </div>
        </section>
        <section>
          <Eyebrow>الأمان</Eyebrow>
          <Checkbox label="لازم رمز إضافي من الموبايل" description="مستحسن للإدارة والحسابات ومدير النظام" checked={mfa} onChange={setMfa} disabled={!canManage} />
        </section>
        {error && <Alert>{error}</Alert>}
      </div>
    </Dialog>
  );
}

function CreateRole({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const form = useRecordForm({ code: '', name: '', description: '', mfaRequired: false, permissions: ['masterdata.read'] });
  const save = () =>
    form.run(roleCreateSchema, async (data) => {
      await api.post('/roles', data);
      await qc.invalidateQueries({ queryKey: ['roles'] });
      toast('ok', 'اتعمل الدور. افتحه عشان تختار صلاحياته.');
      onClose();
    });
  return (
    <Dialog open onClose={onClose} title="دور جديد" footer={<><Button variant="primary" loading={form.busy} onClick={save}>إنشاء</Button><Button onClick={onClose}>إلغاء</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex flex-col gap-4" noValidate>
        <Field label="اسم الدور" htmlFor="rn" error={form.fields.name} required>
          <Input id="rn" value={String(form.values.name)} onChange={(e) => form.set('name', e.target.value)} placeholder="مشرف المعمل" invalid={!!form.fields.name} />
        </Field>
        <Field label="كود الدور" htmlFor="rc" error={form.fields.code} hint="إنجليزي كبير، زي LAB_SUPERVISOR" required>
          <Input id="rc" dir="ltr" className="text-left" value={String(form.values.code)} onChange={(e) => form.set('code', e.target.value)} invalid={!!form.fields.code} />
        </Field>
        <Field label="وصف" htmlFor="rd">
          <Input id="rd" value={String(form.values.description)} onChange={(e) => form.set('description', e.target.value)} />
        </Field>
        <FormError error={form.error} fields={form.fields} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
