'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { num } from '@/lib/format';
import { Button, Chip, cx, Input } from './ui';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
  primary?: boolean;
}

/**
 * جدول على الكمبيوتر والتابلت، وكروت على الموبايل.
 * كل صف بيتفتح بالضغط عليه (أو بالكيبورد).
 */
export function DataList<T extends { id: string; isActive?: boolean }>({
  rows,
  columns,
  onOpen,
  status,
}: {
  rows: T[];
  columns: Column<T>[];
  onOpen?: (row: T) => void;
  status?: (row: T) => ReactNode;
}) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary);
  const statusOf = status ?? ((r: T) => (r.isActive === false ? <Chip tone="neutral">متوقف</Chip> : <Chip tone="ok">شغال</Chip>));

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-panel md:block">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-[12px] text-muted">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cx('px-4 py-3 font-medium whitespace-nowrap', c.numeric ? 'text-left' : 'text-right')}>
                  {c.label}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                tabIndex={onOpen ? 0 : undefined}
                onClick={onOpen ? () => onOpen(r) : undefined}
                onKeyDown={onOpen ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(r)) : undefined}
                className={cx('border-b border-line last:border-0', onOpen && 'cursor-pointer hover:bg-card focus-visible:bg-card', r.isActive === false && 'text-muted')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cx('px-4 py-3', c.numeric && 'tabular text-left', c === primary && 'font-medium')}>
                    {c.render(r)}
                  </td>
                ))}
                <td className="px-4 py-3">{statusOf(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={onOpen ? () => onOpen(r) : undefined}
              disabled={!onOpen}
              className={cx('w-full rounded-2xl border border-line bg-panel p-4 text-right', r.isActive === false && 'opacity-70')}
            >
              <span className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[15px] font-medium">{primary.render(r)}</span>
                {statusOf(r)}
              </span>
              <span className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
                {rest.map((c) => (
                  <span key={c.key} className="flex min-w-0 flex-col">
                    <span className="text-muted">{c.label}</span>
                    <span className={cx('truncate', c.numeric && 'tabular')}>{c.render(r)}</span>
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function SearchBar({ value, onChange, placeholder = 'دوّر…', children }: { value: string; onChange: (v: string) => void; placeholder?: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-faint" />
        <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pr-9" aria-label="بحث" />
      </div>
      {children}
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-[13px] text-muted">
      <span className="tabular">{num(total)} سجل</span>
      {pages > 1 && (
        <span className="flex items-center gap-2">
          <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="الصفحة اللي قبل">
            <ChevronRight className="size-4" />
          </Button>
          <span className="tabular">
            {num(page)} من {num(pages)}
          </span>
          <Button size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="الصفحة اللي بعد">
            <ChevronLeft className="size-4" />
          </Button>
        </span>
      )}
    </div>
  );
}
