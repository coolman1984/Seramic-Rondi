'use client';

import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Loader2, X } from 'lucide-react';

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

// ───────── الأزرار ─────────

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-[9px] border font-medium whitespace-nowrap transition',
        'disabled:cursor-not-allowed disabled:opacity-55',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-9 px-3.5 text-[13.5px]',
        size === 'lg' && 'h-11 px-5 text-[15px]',
        variant === 'primary' && 'border-accent bg-accent text-accent-ink hover:bg-accent-hover hover:border-accent-hover',
        variant === 'secondary' && 'border-line bg-panel text-ink hover:-translate-y-px hover:shadow-soft',
        variant === 'ghost' && 'border-transparent bg-transparent text-ink-2 hover:bg-card',
        variant === 'danger' && 'border-bad/30 bg-panel text-bad hover:bg-bad-soft',
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

// ───────── الخانات ─────────

export function Field({ label, error, hint, children, htmlFor, required }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
        {required && <span className="text-bad"> *</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[12.5px] leading-5 text-bad">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] leading-5 text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  'h-10 w-full rounded-[10px] border bg-panel px-3 text-[14.5px] text-ink placeholder:text-faint transition outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 disabled:bg-card disabled:text-muted';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ invalid, className, ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cx(inputBase, invalid ? 'border-bad' : 'border-line', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select({ invalid, className, children, ...rest }, ref) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={cx(inputBase, 'appearance-auto', invalid ? 'border-bad' : 'border-line', className)} {...rest}>
      {children}
    </select>
  );
});

export function Checkbox({ label, checked, onChange, disabled, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; description?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('flex cursor-pointer items-start gap-2.5', disabled && 'cursor-not-allowed opacity-60')}>
      <input id={id} type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex flex-col">
        <span className="text-[14px]">{label}</span>
        {description && <span className="text-[12px] text-muted">{description}</span>}
      </span>
    </label>
  );
}

// ───────── العناوين ─────────

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[11.5px] font-semibold tracking-[0.08em] text-accent">{children}</p>;
}

export function PageHeader({ eyebrow, title, dim, sub, actions }: { eyebrow?: string; title: string; dim?: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="font-serif text-[clamp(24px,3.2vw,32px)] leading-[1.45] font-normal">
          {title} {dim && <span className="text-muted">{dim}</span>}
        </h1>
        {sub && <p className="mt-1.5 text-[14px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

// ───────── شارات ─────────

export function Chip({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'blue'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-px text-[11.5px] whitespace-nowrap',
        tone === 'neutral' && 'bg-card-2 text-ink-2',
        tone === 'ok' && 'bg-ok-soft text-ok',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'bad' && 'bg-bad-soft text-bad',
        tone === 'blue' && 'bg-accent-soft text-accent',
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: 'ok' | 'warn' | 'bad' | 'blue' | 'muted' }) {
  const color = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', blue: 'bg-accent', muted: 'bg-faint' }[tone];
  return <span aria-hidden className={cx('inline-block size-[7px] shrink-0 rounded-full', color)} />;
}

// ───────── رسايل ─────────

export function Alert({ tone = 'bad', children }: { tone?: 'bad' | 'warn' | 'ok' | 'blue'; children: ReactNode }) {
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      className={cx(
        'rounded-[10px] px-3.5 py-2.5 text-[13.5px] leading-6',
        tone === 'bad' && 'bg-bad-soft text-bad',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'ok' && 'bg-ok-soft text-ok',
        tone === 'blue' && 'bg-accent-soft text-accent',
      )}
    >
      {children}
    </div>
  );
}

export function Spinner({ label = 'بيحمّل…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[13.5px] text-muted" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function Empty({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-14 text-center">
      <p className="font-serif text-[19px]">{title}</p>
      {sub && <p className="max-w-md text-[13.5px] text-muted">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ───────── نافذة منبثقة ─────────

export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cx(
        'm-auto w-[calc(100%-24px)] rounded-2xl border border-line bg-panel p-0 text-ink shadow-2xl',
        wide ? 'max-w-3xl' : 'max-w-lg',
      )}
      aria-label={title}
    >
      {open && (
        <div className="flex max-h-[88vh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 className="font-serif text-[19px]">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-card" aria-label="إغلاق">
              <X className="size-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-start gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl bg-card p-5', className)}>{children}</div>;
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-panel', className)}>{children}</div>;
}
