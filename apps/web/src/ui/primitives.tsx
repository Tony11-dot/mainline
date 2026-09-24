import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-[0_1px_0_0_rgb(255_255_255/0.2)_inset,0_1px_2px_rgb(0_0_0/0.12)] hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 active:bg-surface-3 shadow-1',
  ghost: 'text-ink-2 hover:bg-surface-3 hover:text-ink active:bg-surface-3',
  danger: 'bg-bad text-white hover:brightness-110',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon; loading?: boolean }>(
  function Button({ variant = 'secondary', size = 'md', icon: Icon, loading, className = '', children, disabled, ...rest }, ref) {
    const sizes = { sm: 'h-8 px-3 text-sm gap-1.5 rounded-[10px]', md: 'h-11 px-4 text-base gap-2 rounded-[12px]', lg: 'h-14 px-6 text-md gap-2.5 rounded-[16px]' };
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={`inline-flex shrink-0 items-center justify-center font-semibold transition-[background-color,filter,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${sizes[size]} ${VARIANTS[variant]} ${className}`}
        {...rest}
      >
        {loading ? <Spinner /> : Icon ? <Icon size={size === 'sm' ? 15 : 18} strokeWidth={2.2} aria-hidden /> : null}
        {children}
      </button>
    );
  },
);

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; active?: boolean; size?: number }>(
  function IconButton({ icon: Icon, label, active, size = 44, className = '', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={active}
        style={{ width: size, height: size }}
        className={`inline-flex shrink-0 items-center justify-center rounded-[12px] transition-[background-color,color,transform] duration-150 active:scale-95 disabled:opacity-35 disabled:pointer-events-none ${
          active ? 'bg-brand-soft text-brand-ink' : 'text-ink-2 hover:bg-surface-3 hover:text-ink'
        } ${className}`}
        {...rest}
      >
        <Icon size={20} strokeWidth={2} aria-hidden />
      </button>
    );
  },
);

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, className = '' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={`relative flex rounded-[12px] bg-surface-3 p-[3px] ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative h-8 flex-1 rounded-[9px] px-3 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 ${
              active ? 'bg-surface text-ink shadow-1' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[8px] bg-surface-3 ${className}`} aria-hidden />;
}

/** Friendly inline state for empty / error / not-configured panels. */
export function PanelNote({ icon: Icon, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-8 text-center">
      {Icon && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-3 text-ink-2">
          <Icon size={20} aria-hidden />
        </div>
      )}
      <p className="text-base font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-[34ch] text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
