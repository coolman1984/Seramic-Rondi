'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Boxes, ClipboardList, Factory, History, Layers, Palette, Ruler, Shield, Users } from 'lucide-react';
import { MODULES } from '@rondi/shared';
import { api } from '@/lib/api';
import { useCan, useMe } from '@/lib/auth';
import { arDigits, num } from '@/lib/format';
import { Chip, Eyebrow } from '@/components/ui';

type Options = Record<string, Array<{ id: string; code: string; label: string }>>;

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Africa/Cairo' }).format(new Date()));
  if (h < 12) return 'صباح الخير';
  if (h < 18) return 'مساء النور';
  return 'مساء الخير';
}

export default function HomePage() {
  const { data: me } = useMe();
  const can = useCan();
  const { data: opts } = useQuery({ queryKey: ['master-options'], queryFn: () => api.get<Options>('/master/options'), enabled: can('masterdata.read') });

  if (!me) return null;
  const first = me.user.fullName.split(' ').slice(0, 2).join(' ');

  const quick = [
    { href: '/master/variants', icon: Layers, label: 'الأصناف والتعبئة', count: opts?.variants.length, perm: 'masterdata.read' as const },
    { href: '/master/materials', icon: Boxes, label: 'الخامات', count: opts?.materials.length, perm: 'masterdata.read' as const },
    { href: '/master/equipment', icon: Factory, label: 'المعدات والأفران', count: opts?.equipment.length, perm: 'masterdata.read' as const },
    { href: '/master/shades', icon: Palette, label: 'درجات اللون', count: opts?.shades.length, perm: 'masterdata.read' as const },
    { href: '/master/sizes', icon: Ruler, label: 'المقاسات', count: opts?.sizes.length, perm: 'masterdata.read' as const },
    { href: '/users', icon: Users, label: 'المستخدمين', perm: 'users.read' as const },
    { href: '/roles', icon: Shield, label: 'الأدوار والصلاحيات', perm: 'users.read' as const },
    { href: '/audit', icon: History, label: 'سجل العمليات', perm: 'audit.read' as const },
  ].filter((q) => can(q.perm));

  const upcoming = MODULES.filter((m) => me.permissions.includes(`${m.key}.read` as never));

  return (
    <div className="flex flex-col gap-14">
      <section className="sky-soft overflow-hidden rounded-[20px] border border-line px-5 py-10 text-center sm:px-10 sm:py-14">
        <p className="mb-3 text-[13px] text-muted">
          {me.user.role.name} · <span className="tabular">{new Intl.DateTimeFormat('ar-EG', { dateStyle: 'full', timeZone: 'Africa/Cairo' }).format(new Date())}</span>
        </p>
        <h1 className="mx-auto max-w-[16em] font-serif text-[clamp(28px,4.4vw,44px)] leading-[1.35] font-normal">
          {greeting()} يا {first}، <span className="text-muted">المصنع كله قدامك هنا.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] text-muted">
          ده الأساس اللي باقي الأنظمة هتتبني عليه: المستخدمين وصلاحياتهم، والموديلات والمقاسات والخامات والخطوط والورديات.
        </p>
      </section>

      {quick.length > 0 && (
        <section>
          <Eyebrow>المتاح لك دلوقتي</Eyebrow>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {quick.map((q) => (
              <Link key={q.href} href={q.href} className="group flex flex-col gap-3 rounded-2xl bg-card p-4 transition hover:bg-card-2">
                <span className="grid h-20 place-items-center rounded-xl bg-panel text-muted transition group-hover:text-accent">
                  <q.icon className="size-7" strokeWidth={1.4} />
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-medium">{q.label}</span>
                  {q.count !== undefined ? <span className="tabular text-[13px] text-muted">{num(q.count)}</span> : <ArrowLeft className="size-4 text-faint" />}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <Eyebrow>جاي في المراحل الجاية</Eyebrow>
          <h2 className="mb-5 font-serif text-[22px] font-normal">
            الشاشات دي هتظهر لك <span className="text-muted">أول ما مرحلتها تخلص.</span>
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {upcoming.map((m) => (
              <li key={m.key} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3">
                <span className="flex items-center gap-2.5 text-[14px]">
                  <ClipboardList className="size-4 text-faint" /> {m.label}
                </span>
                <Chip tone="neutral">المرحلة {arDigits(m.phase)}</Chip>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
