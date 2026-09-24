'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import { MASTER_DATA, MASTER_DATA_KINDS, sqmPerCarton, sqmPerPallet, type MasterDataKind } from '@rondi/shared';
import { api, qs, type Page } from '@/lib/api';
import { useCan } from '@/lib/auth';
import { dateTime, num } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import { MASTER_UI, type Row } from '@/lib/master-config';
import { DataList, Pager, SearchBar } from '@/components/data-list';
import { FieldInput, FormError, useRecordForm } from '@/components/record-form';
import { useToast } from '@/components/toast';
import { Button, Checkbox, Dialog, Empty, PageHeader, Spinner } from '@/components/ui';

type Options = Record<string, Array<{ id: string; code: string; label: string }>>;

export default function MasterKindPage() {
  const { kind } = useParams<{ kind: string }>();
  if (!(MASTER_DATA_KINDS as string[]).includes(kind)) {
    return <Empty title="القائمة دي مش موجودة" action={<Link href="/master" className="text-accent">رجوع للبيانات الأساسية</Link>} />;
  }
  return <KindScreen kind={kind as MasterDataKind} />;
}

function KindScreen({ kind }: { kind: MasterDataKind }) {
  const meta = MASTER_DATA[kind];
  const ui = MASTER_UI[kind];
  const can = useCan();
  const canManage = can('masterdata.manage');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [inactive, setInactive] = useState(false);
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const search = useDebounced(q);

  const list = useQuery({
    queryKey: ['master', kind, search, page, inactive],
    queryFn: () => api.get<Page<Row>>(`/master/${kind}${qs({ q: search, page, pageSize: 50, includeInactive: inactive })}`),
  });

  return (
    <>
      <Link href="/master" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-accent">
        <ArrowRight className="size-3.5" /> البيانات الأساسية
      </Link>
      <PageHeader
        eyebrow="البيانات الأساسية"
        title={meta.label}
        sub={ui.description}
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus className="size-4" /> إضافة {meta.single}
            </Button>
          )
        }
      />
      <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={`دوّر في ${meta.label}…`}>
        <Checkbox label="إظهار المتوقف" checked={inactive} onChange={(v) => { setInactive(v); setPage(1); }} />
      </SearchBar>
      {list.isLoading ? (
        <Spinner />
      ) : list.data && list.data.rows.length > 0 ? (
        <>
          <DataList rows={list.data.rows} columns={ui.columns} onOpen={(r) => setEditing(r)} />
          <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
        </>
      ) : (
        <Empty title={q ? 'مفيش نتايج' : `لسه مفيش ${meta.label}`} sub={q ? 'جرب كلمة تانية أو جزء من الكود.' : undefined} />
      )}
      {editing && <EditDialog kind={kind} row={editing === 'new' ? null : editing} canManage={canManage} onClose={() => setEditing(null)} />}
    </>
  );
}

function EditDialog({ kind, row, canManage, onClose }: { kind: MasterDataKind; row: Row | null; canManage: boolean; onClose: () => void }) {
  const meta = MASTER_DATA[kind];
  const ui = MASTER_UI[kind];
  const qc = useQueryClient();
  const toast = useToast();
  const [confirmToggle, setConfirmToggle] = useState(false);

  const initial = useMemo(() => {
    if (!row) return { ...ui.empty };
    const v: Record<string, unknown> = {};
    for (const f of ui.fields) v[f.name] = row[f.name] ?? (f.type === 'ref' ? null : '');
    return v;
  }, [row, ui]);
  const form = useRecordForm(initial);

  const needsRefs = ui.fields.some((f) => f.type === 'ref');
  const { data: options } = useQuery({ queryKey: ['master-options'], queryFn: () => api.get<Options>('/master/options'), enabled: needsRefs });
  // للأصناف: نحتاج أبعاد المقاس عشان نحسب المتر قدام المستخدم
  const { data: sizes } = useQuery({ queryKey: ['master', 'sizes', 'all'], queryFn: () => api.get<Page<Row>>('/master/sizes?pageSize=200'), enabled: kind === 'variants' });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['master', kind] });
    await qc.invalidateQueries({ queryKey: ['master-options'] });
  };

  const save = () =>
    form.run(meta.schema, async (data) => {
      if (row) await api.patch(`/master/${kind}/${row.id}`, { ...data, version: row.version });
      else await api.post(`/master/${kind}`, data);
      await refresh();
      toast('ok', row ? 'اتحفظ التعديل' : `اتضاف ${meta.single} جديد`);
      onClose();
    });

  const toggle = async () => {
    if (!row) return;
    try {
      await api.post(`/master/${kind}/${row.id}/${row.isActive ? 'deactivate' : 'activate'}`, { version: row.version });
      await refresh();
      toast('ok', row.isActive ? 'اتوقف' : 'اتفعّل تاني');
      onClose();
    } catch (e) {
      form.setError(e instanceof Error ? e.message : 'حصلت مشكلة');
    }
  };

  const variantPreview = (() => {
    if (kind !== 'variants' || !sizes) return null;
    const s = sizes.rows.find((x) => x.id === form.values.sizeId);
    const pieces = Number(String(form.values.piecesPerCarton).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
    const cartons = Number(String(form.values.cartonsPerPallet).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
    if (!s || !pieces) return null;
    return (
      <div className="rounded-xl bg-accent-soft px-4 py-3 text-[13.5px] text-accent">
        الكرتونة = <b className="tabular">{num(sqmPerCarton(s.lengthMm, s.widthMm, pieces), 4)} م²</b>
        {cartons > 0 && (
          <>
            {' '}· البالتة = <b className="tabular">{num(sqmPerPallet(s.lengthMm, s.widthMm, pieces, cartons), 2)} م²</b>
          </>
        )}
      </div>
    );
  })();

  const readOnly = !canManage;

  return (
    <Dialog
      open
      onClose={onClose}
      title={row ? `${readOnly ? '' : 'تعديل '}${meta.single}: ${row.label}` : `إضافة ${meta.single}`}
      footer={
        readOnly ? (
          <Button onClick={onClose}>إغلاق</Button>
        ) : (
          <>
            <Button variant="primary" loading={form.busy} onClick={save}>
              حفظ
            </Button>
            <Button onClick={onClose}>إلغاء</Button>
            {row &&
              (confirmToggle ? (
                <span className="ms-auto flex items-center gap-2 text-[13px]">
                  متأكد؟
                  <Button size="sm" variant={row.isActive ? 'danger' : 'primary'} onClick={toggle}>
                    {row.isActive ? 'أيوه، وقّفه' : 'أيوه، فعّله'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmToggle(false)}>
                    لأ
                  </Button>
                </span>
              ) : (
                <Button variant={row.isActive ? 'danger' : 'secondary'} className="ms-auto" onClick={() => setConfirmToggle(true)}>
                  {row.isActive ? 'إيقاف' : 'تفعيل تاني'}
                </Button>
              ))}
          </>
        )
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!readOnly) void save();
        }}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {ui.fields.map((f) => (
            <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : undefined}>
              <FieldInput
                def={f}
                value={form.values[f.name]}
                onChange={(v) => form.set(f.name, v)}
                error={form.fields[f.name]}
                refOptions={f.ref ? options?.[f.ref] : undefined}
                disabled={readOnly || (!!row && f.lockOnEdit)}
              />
            </div>
          ))}
        </div>
        {variantPreview}
        <FormError error={form.error} fields={form.fields} />
        {row && (
          <p className="text-[12px] text-muted">
            آخر تعديل: <span className="tabular">{dateTime(row.updatedAt)}</span> · النسخة <span className="tabular">{num(row.version)}</span>
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
