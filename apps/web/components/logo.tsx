import { cx } from './ui';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cx('size-7', className)}>
      <rect x="3" y="3" width="12" height="12" rx="2.5" fill="currentColor" opacity=".85" />
      <rect x="17" y="3" width="12" height="12" rx="2.5" fill="currentColor" opacity=".35" />
      <rect x="3" y="17" width="12" height="12" rx="2.5" fill="currentColor" opacity=".35" />
      <rect x="17" y="17" width="12" height="12" rx="2.5" fill="currentColor" opacity=".6" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5 font-serif text-[21px] font-medium text-ink', className)}>
      <LogoMark />
      روندي
    </span>
  );
}
