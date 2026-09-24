'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { MASTER_DATA, MASTER_DATA_KINDS } from '@rondi/shared';
import { api } from '@/lib/api';
import { num } from '@/lib/format';
import { GROUPS, MASTER_UI } from '@/lib/master-config';
import { Eyebrow, PageHeader } from '@/components/ui';

export default function MasterIndex() {
  const { data } = useQuery({ queryKey: ['master-options'], queryFn: () => api.get<Record<string, unknown[]>>('/master/options') });
  return (
    <>
      <PageHeader eyebrow="البيانات الأساسية" title="القوائم اللي كل النظام بيعتمد عليها،" dim="اتسجلت مرة واحدة بس." sub="أي تعديل هنا بيتسجل في سجل العمليات بالقيمة القديمة والجديدة. ومفيش حاجة بتتمسح: اللي مش محتاجه بيتوقف بس." />
      <div className="flex flex-col gap-10">
        {GROUPS.map((g) => (
          <section key={g.key}>
            <Eyebrow>{g.label}</Eyebrow>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MASTER_DATA_KINDS.filter((k) => MASTER_UI[k].group === g.key).map((k) => (
                <Link key={k} href={`/master/${k}`} className="group flex flex-col gap-2 rounded-2xl bg-card p-5 transition hover:bg-card-2">
                  <span className="flex items-center justify-between">
                    <span className="text-[15px] font-medium">{MASTER_DATA[k].label}</span>
                    <span className="tabular text-[13px] text-muted">{data ? num(data[k]?.length ?? 0) : ''}</span>
                  </span>
                  <span className="text-[13px] leading-6 text-muted">{MASTER_UI[k].description}</span>
                  <ArrowLeft className="mt-1 size-4 text-faint transition group-hover:text-accent" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
