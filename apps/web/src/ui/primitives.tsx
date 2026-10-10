import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
/** Filled for the one main action, tonal for the rest, ghost for the quiet ones, danger for the destructive one. */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand shadow-[0_1px_0_0_rgb(255_255_255/0.2)_inset,0_1px_2px_rgb(0_0_0/0.12)] hover:brightness-110 active:brightness-95',
  secondary: 'bg-brand-soft text-brand-ink hover:bg-brand-soft-2 active:bg-brand-soft-2',
  ghost: 'text-ink-2 hover:bg-surface-3 hover:text-ink active:bg-surface-3',
  danger: 'bg-bad text-white hover:brightness-110',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon; loading?: boolean }>(
  function Button({ variant = 'secondary', size = 'md', icon: Icon, loading, className = '', children, disabled, ...rest }, ref) {
    const sizes = { sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-[var(--radius-s)]', md: 'h-11 px-4 text-base gap-2 rounded-[var(--radius-control)]', lg: 'h-14 px-6 text-md gap-2.5 rounded-[var(--radius-m)]' };
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={`inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background-color,filter,transform,opacity] duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.98] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-45 ${sizes[size]} ${VARIANTS[variant]} ${className}`}
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
        className={`inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] transition-[background-color,color,transform] duration-[var(--dur-fast)] active:scale-95 motion-reduce:active:scale-100 disabled:opacity-35 disabled:pointer-events-none ${
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
    <div role="tablist" aria-label={label} className={`relative flex rounded-[var(--radius-control)] bg-surface-3 p-[3px] ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative min-h-9 flex-1 rounded-[9px] px-3 py-1 text-sm leading-tight font-semibold transition-[background-color,color,box-shadow] duration-[var(--dur-base)] ${
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
  return <div className={`animate-pulse rounded-[var(--radius-xs)] bg-surface-3 ${className}`} aria-hidden />;
}

/** Friendly inline state for empty / error / not-configured panels: an icon in the brand tint, a title, a line of help, the next step. */
export function PanelNote({ icon: Icon, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {Icon && (
        <div className="mb-4 flex size-14 items-center justify-center rounded-[var(--radius-m)] bg-brand-soft text-brand-ink">
          <Icon size={26} aria-hidden />
        </div>
      )}
      <h3 className="text-md font-bold text-ink">{title}</h3>
      {children && <div className="mt-1 max-w-[36ch] text-base text-ink-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
