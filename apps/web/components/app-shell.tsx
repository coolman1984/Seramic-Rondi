'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, LogOut, Menu, UserRound, WifiOff, X } from 'lucide-react';
import type { Permission } from '@rondi/shared';
import { api } from '@/lib/api';
import { useMe, useSetMe } from '@/lib/auth';
import { LogoMark } from './logo';
import { Button, cx, Spinner } from './ui';

export const NAV: Array<{ href: string; label: string; perm?: Permission }> = [
  { href: '/', label: 'الرئيسية' },
  { href: '/master', label: 'البيانات الأساسية', perm: 'masterdata.read' },
  { href: '/users', label: 'المستخدمين', perm: 'users.read' },
  { href: '/roles', label: 'الأدوار والصلاحيات', perm: 'users.read' },
  { href: '/audit', label: 'سجل العمليات', perm: 'audit.read' },
];

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me, isLoading, isError } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const online = useOnline();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (isError) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (me && me.stage !== 'active') router.replace('/login');
  }, [isError, me, pathname, router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (isLoading || !me || me.stage !== 'active') return <Spinner />;

  const items = NAV.filter((n) => !n.perm || me.permissions.includes(n.perm));
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  // لو فتح رابط صفحة مش من صلاحياته: رسالة واضحة (والخادم كمان بيرفض البيانات)
  const section = NAV.find((n) => n.href !== '/' && pathname.startsWith(n.href));
  const forbidden = !!section?.perm && !me.permissions.includes(section.perm);

  return (
    <div className="px-2 py-2 sm:px-4 sm:py-4">
      <div className="mx-auto max-w-[1240px] rounded-[26px] border border-line bg-surface p-2 sm:p-2.5">
        <nav aria-label="القائمة الرئيسية" className="flex items-center gap-3 px-2.5 pt-1.5 pb-3 sm:px-3.5">
          <Link href="/" className="flex items-center gap-2 font-serif text-[20px] font-medium">
            <LogoMark className="text-ink" />
            <span>روندي</span>
          </Link>
          <div className="mx-auto hidden items-center gap-1 lg:flex">
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? 'page' : undefined}
                className={cx(
                  'rounded-lg px-3 py-1.5 text-[13.5px] transition',
                  isActive(n.href) ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:bg-card',
                )}
              >
                {n.label}
              </Link>
            ))}
          </div>
          <div className="ms-auto flex items-center gap-2 lg:ms-0">
            {!online && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-[12px] text-warn" role="status">
                <WifiOff className="size-3.5" /> مفيش نت
              </span>
            )}
            <UserMenu name={me.user.fullName} role={me.user.role.name} />
            <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-label="القائمة">
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />} القائمة
            </Button>
          </div>
        </nav>
        {menuOpen && (
          <div className="mb-2 grid gap-1 rounded-2xl border border-line bg-panel p-2 lg:hidden">
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cx('rounded-xl px-4 py-3 text-[15px]', isActive(n.href) ? 'bg-accent text-accent-ink' : 'hover:bg-card')}
              >
                {n.label}
              </Link>
            ))}
          </div>
        )}
        <main className="min-h-[70vh] rounded-[20px] px-3 py-6 sm:px-8 sm:py-10">
          {forbidden ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-16 text-center">
              <p className="font-serif text-[22px]">الصفحة دي مش ضمن صلاحياتك</p>
              <p className="text-[14px] text-muted">لو محتاجها في شغلك، كلّم مدير النظام يضيفها لدورك.</p>
              <Link href="/" className="mt-2 text-[14px] text-accent">رجوع للرئيسية</Link>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function UserMenu({ name, role }: { name: string; role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const setMe = useSetMe();
  const router = useRouter();

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const logout = async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setMe(null);
    router.replace('/login');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-[10px] border border-line bg-panel py-1 ps-1 pe-2.5 text-[13px] hover:shadow-soft"
      >
        <span aria-hidden className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-[#d9c6b0] to-[#9f8a74] text-[12px] font-semibold text-white">
          {name.replace(/^(م\.|د\.|أ\.)\s*/, '').charAt(0)}
        </span>
        <span className="hidden max-w-[10em] truncate sm:inline">{name}</span>
        <ChevronDown className="size-3.5 text-muted" />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-30 mt-2 w-60 rounded-xl border border-line bg-panel p-1.5 shadow-soft">
          <div className="border-b border-line px-3 pt-1.5 pb-2.5">
            <p className="truncate text-[14px] font-medium">{name}</p>
            <p className="text-[12px] text-muted">{role}</p>
          </div>
          <Link href="/account" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-[13.5px] hover:bg-card">
            <UserRound className="size-4 text-muted" /> حسابي والأمان
          </Link>
          <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13.5px] text-bad hover:bg-bad-soft">
            <LogOut className="size-4" /> خروج
          </button>
        </div>
      )}
    </div>
  );
}
