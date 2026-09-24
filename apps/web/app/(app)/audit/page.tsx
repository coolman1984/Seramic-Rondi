'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { PERMISSIONS } from '@rondi/shared';
import { api, qs, type Page } from '@/lib/api';
import { dateTime, num } from '@/lib/format';
import { Pager } from '@/components/data-list';
import { Chip, cx, Empty, PageHeader, Select, Spinner } from '@/components/ui';

interface Entry {
  id: string;
  at: string;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
}

const ACTIONS: Record<string, { label: string; tone: 'neutral' | 'ok' | 'warn' | 'bad' | 'blue' }> = {
  CREATE: { label: 'إضافة', tone: 'ok' },
  UPDATE: { label: 'تعديل', tone: 'blue' },
  DEACTIVATE: { label: 'إيقاف', tone: 'warn' },
  ACTIVATE: { label: 'تفعيل', tone: 'ok' },
  LOGIN: { label: 'دخول', tone: 'neutral' },
  LOGOUT: { label: 'خروج', tone: 'neutral' },
  LOGIN_FAILED: { label: 'دخول غلط', tone: 'bad' },
  LOGIN_BLOCKED: { label: 'دخول وهو مقفول', tone: 'bad' },
  ACCOUNT_LOCKED: { label: 'الحساب اتقفل', tone: 'bad' },
  UNLOCK: { label: 'فك القفل', tone: 'warn' },
  PASSWORD_CHANGE: { label: 'غيّر كلمة السر', tone: 'neutral' },
  PASSWORD_RESET: { label: 'كلمة سر من المدير', tone: 'warn' },
  MFA_ENABLE: { label: 'فعّل الرمز الإضافي', tone: 'ok' },
  MFA_VERIFY: { label: 'أكّد الرمز الإضافي', tone: 'neutral' },
  MFA_DISABLE: { label: 'لغى الرمز الإضافي', tone: 'warn' },
  MFA_RESET: { label: 'المدير لغى الرمز', tone: 'warn' },
  SESSION_REVOKE: { label: 'قفل جهاز', tone: 'neutral' },
  SEED: { label: 'تجهيز النظام', tone: 'neutral' },
};

const ENTITIES: Record<string, string> = {
  user: 'مستخدم',
  role: 'دور',
  auth: 'دخول',
  session: 'جهاز',
  product_model: 'موديل',
  size: 'مقاس',
  product_variant: 'صنف',
  shade: 'درجة لون',
  caliber: 'عيار',
  material: 'خامة',
  production_line: 'خط إنتاج',
  equipment: 'معدة',
  shift: 'وردية',
  masterdata: 'بيانات أساسية',
};

const FIELDS: Record<string, string> = {
  code: 'الكود', name: 'الاسم', fullName: 'الاسم', username: 'اسم الدخول', phone: 'الموبايل', roleId: 'الدور',
  permissions: 'الصلاحيات', isActive: 'شغال', mfaRequired: 'رمز إضافي مطلوب', mfaEnabled: 'الرمز الإضافي', description: 'الوصف',
  body: 'البودي', use: 'الاستخدام', finish: 'السطح', notes: 'ملاحظات', lengthMm: 'الطول', widthMm: 'العرض', thicknessMm: 'السُمك',
  piecesPerCarton: 'بلاطة/كرتونة', cartonsPerPallet: 'كرتونة/بالتة', sqmPerCarton: 'م²/كرتونة', sqmPerPallet: 'م²/بالتة',
  cartonWeightKg: 'وزن الكرتونة', category: 'النوع', unit: 'الوحدة', minStock: 'حد الطلب', leadTimeDays: 'مدة التوريد',
  capacitySqmPerDay: 'الطاقة اليومية', type: 'النوع', stage: 'المرحلة', lineId: 'الخط', startTime: 'البداية', endTime: 'النهاية',
  lockedUntil: 'مقفول لحد', reason: 'السبب', attempt: 'رقم المحاولة',
};

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'أيوه' : 'لأ';
  if (Array.isArray(v)) return v.map((x) => PERMISSIONS[x as keyof typeof PERMISSIONS] ?? String(x)).join('، ') || '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** اسم السجل اللي اتعمل عليه العملية (لو متسجل) */
function subject(e: Entry): string | null {
  const src = { ...(e.before ?? {}), ...(e.after ?? {}) } as Record<string, unknown>;
  const v = src.name ?? src.fullName ?? src.username ?? src.code;
  return typeof v === 'string' ? v : null;
}

function Changes({ e }: { e: Entry }) {
  const keys = Array.from(new Set([...Object.keys(e.before ?? {}), ...Object.keys(e.after ?? {})])).filter((k) => !['id', 'version'].includes(k));
  if (!keys.length) return null;
  return (
    <dl className="mt-2 grid gap-1.5 text-[12.5px]">
      {keys.map((k) => (
        <div key={k} className="grid grid-cols-[7em_1fr] gap-2">
          <dt className="text-muted">{FIELDS[k] ?? k}</dt>
          <dd className="min-w-0 break-words">
            {e.before && k in e.before && <span className="text-bad line-through decoration-bad/40">{show(e.before[k])}</span>}
            {e.before && k in e.before && e.after && k in e.after && <span className="mx-1.5 text-faint">←</span>}
            {e.after && k in e.after && <span className="text-ink">{show(e.after[k])}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function AuditPage() {
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['audit', entity, action, page],
    queryFn: () => api.get<Page<Entry>>(`/audit${qs({ entity, action, page, pageSize: 50 })}`),
  });
  const verify = useQuery({ queryKey: ['audit-verify'], queryFn: () => api.get<{ ok: boolean; total: number; brokenId?: string }>('/audit/verify') });

  return (
    <>
      <PageHeader
        eyebrow="سجل العمليات"
        title="مين عمل إيه وإمتى،"
        dim="والسجل ده ميتمسحش ولا يتعدل."
        sub="كل سطر مربوط باللي قبله ببصمة رقمية. لو حد لعب في قاعدة البيانات نفسها، النظام بيكشفه."
      />
      {verify.data && (
        <div
          className={cx(
            'mb-6 flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px]',
            verify.data.ok ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad',
          )}
          role="status"
        >
          {verify.data.ok ? <ShieldCheck className="size-5" /> : <ShieldAlert className="size-5" />}
          {verify.data.ok
            ? `السجل سليم: ${num(verify.data.total)} عملية ومفيش أي تلاعب.`
            : `تحذير: السطر رقم ${verify.data.brokenId} اتغير بعد ما اتسجل. بلّغ الإدارة فوراً.`}
        </div>
      )}
      <div className="mb-4 grid gap-3 sm:grid-cols-[14rem_14rem]">
        <Select aria-label="النوع" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
          <option value="">كل الأنواع</option>
          {Object.entries(ENTITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select aria-label="العملية" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">كل العمليات</option>
          {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>
      {list.isLoading ? (
        <Spinner />
      ) : list.data?.rows.length ? (
        <>
          <ol className="flex flex-col gap-2">
            {list.data.rows.map((e) => {
              const a = ACTIONS[e.action] ?? { label: e.action, tone: 'neutral' as const };
              const expandable = !!(e.before || e.after);
              return (
                <li key={e.id} className="rounded-xl border border-line bg-panel px-4 py-3">
                  <button
                    type="button"
                    disabled={!expandable}
                    onClick={() => setOpen(open === e.id ? null : e.id)}
                    aria-expanded={expandable ? open === e.id : undefined}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-right"
                  >
                    <Chip tone={a.tone}>{a.label}</Chip>
                    <span className="text-[14px]">
                      <b className="font-medium">{e.actorName ?? 'النظام'}</b>
                      <span className="text-muted"> · {ENTITIES[e.entity] ?? e.entity}</span>
                      {subject(e) && <span className="text-ink-2"> {subject(e)}</span>}
                    </span>
                    <span className="tabular ms-auto text-[12.5px] text-muted">{dateTime(e.at)}</span>
                  </button>
                  {open === e.id && <Changes e={e} />}
                </li>
              );
            })}
          </ol>
          <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
        </>
      ) : (
        <Empty title="مفيش عمليات بالفلتر ده" />
      )}
    </>
  );
}
