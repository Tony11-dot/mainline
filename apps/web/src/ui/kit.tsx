import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ChevronRight, Search, X, type LucideIcon } from 'lucide-react';
import { t } from '../lib/i18n';
import { PanelNote } from './primitives';

/**
 * The shared building blocks every screen is made of: one card, one section header, one list row,
 * one pill. A screen composes these; it doesn't restyle them. Colours come from the theme tokens only,
 * so the 19 user themes, dark mode and Reduce Transparency keep working.
 *
 * The look: the page is the tinted surface, cards are plain white lifted off it (no border), titles are
 * big and tight, secondary actions are tonal. Hierarchy comes from scale and tone, not from lines.
 */

/** The card surface: white on the tinted page, no border, the softest lift. */
export const CARD = 'rounded-[var(--radius-l)] bg-surface shadow-card';
/** The same surface drawn as an invitation (an empty slot, an "add" action): dashed, no fill. */
export const CARD_DASHED = 'rounded-[var(--radius-l)] border border-dashed border-line-strong';

export function Card({ children, className = '', pad = true, as: Tag = 'div', ...rest }: { children: ReactNode; className?: string; pad?: boolean; as?: 'div' | 'section' | 'article' | 'dl' | 'figure' } & Record<string, unknown>) {
  return (
    <Tag className={`${CARD} ${pad ? 'p-[var(--card-pad)]' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** Rows that belong together (settings, modes, results): one card, hairlines between the rows. */
export function ListGroup({ children, className = '', ...rest }: { children: ReactNode; className?: string } & Record<string, unknown>) {
  return (
    <div className={`${CARD} divide-y divide-line overflow-hidden ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Names the group of cards or rows under it: a real heading, with an optional action at the end of the line. */
export function SectionHeader({ title, action, hint, as: Tag = 'h2', className = '' }: { title: ReactNode; action?: ReactNode; hint?: ReactNode; as?: 'h2' | 'h3'; className?: string }) {
  return (
    <div className={`mb-3 flex items-end justify-between gap-3 px-1 ${className}`}>
      <div className="min-w-0">
        <Tag className="text-lg font-bold text-ink">{title}</Tag>
        {hint && <p className="mt-0.5 text-sm text-ink-2">{hint}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** A titled section: header, then its content, with the page rhythm between sections. */
export function Section({ title, action, hint, children, className = '', ...rest }: { title: ReactNode; action?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string } & Record<string, unknown>) {
  return (
    <section className={`mt-[var(--section-gap)] ${className}`} {...rest}>
      <SectionHeader title={title} action={action} hint={hint} />
      {children}
    </section>
  );
}

/** A form section is a titled group of rows. */
export function FormSection({ title, hint, children, ...rest }: { title: ReactNode; hint?: ReactNode; children: ReactNode } & Record<string, unknown>) {
  return (
    <Section title={title} hint={hint} {...rest}>
      <ListGroup>{children}</ListGroup>
    </Section>
  );
}

/**
 * The page title line. Top-level screens get the large title; deep screens get a back arrow and a
 * title that truncates rather than wraps the line, with the subtitle (path, opening name) under it.
 * Trailing actions keep their 44pt targets.
 */
export function PageHeader({ title, subtitle, back, backLabel, trailing, large, className = '', children }: { title: ReactNode; subtitle?: ReactNode; back?: string; backLabel?: string; trailing?: ReactNode; large?: boolean; className?: string; children?: ReactNode }) {
  return (
    <div className={`flex min-h-[44px] items-center gap-2 ${className}`}>
      {back && (
        <Link to={back} className="pressable -ms-2 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3 hover:text-ink" aria-label={backLabel ?? t('Back')}>
          <ArrowLeft size={22} className="rtl:rotate-180" aria-hidden />
        </Link>
      )}
      {children}
      <div className="min-w-0 flex-1">
        {/* A page's own big title wraps rather than lose words; a compact one (deep screens) truncates. */}
        <h1 className={`font-bold ${large ? 'text-3xl [overflow-wrap:anywhere] md:text-4xl' : 'truncate text-2xl'}`}>{title}</h1>
        {subtitle && <p className="truncate text-sm text-ink-2">{subtitle}</p>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-1">{trailing}</div>}
    </div>
  );
}

export type Tone = 'brand' | 'neutral' | 'good' | 'warn' | 'bad' | 'flame' | 'freeze' | 'gem';
const TONE: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand-ink',
  neutral: 'bg-surface-3 text-ink-2',
  good: 'bg-good-soft text-good-ink',
  warn: 'bg-warn-soft text-warn-ink',
  bad: 'bg-bad-soft text-bad-ink',
  flame: 'bg-flame-soft text-flame-ink',
  freeze: 'bg-freeze-soft text-freeze',
  gem: 'bg-gem-soft text-gem-ink',
};

/** The coloured square an icon sits in at the start of a row. */
export function IconTile({ icon: Icon, tone = 'brand', size = 'md', className = '' }: { icon: LucideIcon; tone?: Tone; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const box = size === 'sm' ? 'size-8 rounded-[var(--radius-xs)]' : size === 'lg' ? 'size-12 rounded-[var(--radius-control)]' : 'size-10 rounded-[var(--radius-s)]';
  return (
    <span className={`flex shrink-0 items-center justify-center ${box} ${TONE[tone]} ${className}`} aria-hidden>
      <Icon size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} aria-hidden />
    </span>
  );
}

/** A short label with a tint: a state, a tag, a count. Text on every tint reads at 4.5:1. */
export function Pill({ tone = 'neutral', icon: Icon, children, size = 'sm', className = '', title, ...rest }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; size?: 'sm' | 'md'; className?: string; title?: string } & Record<string, unknown>) {
  const dims = size === 'md' ? 'h-8 gap-1.5 px-3 text-sm' : 'h-6 gap-1 px-2 text-xs';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full font-semibold whitespace-nowrap ${dims} ${TONE[tone]} ${className}`} title={title} {...rest}>
      {Icon && <Icon size={size === 'md' ? 15 : 12} aria-hidden />}
      {children}
    </span>
  );
}

interface ListRowProps {
  /** An icon in a tinted tile at the start, or any leading element (a mini board, a swatch). */
  icon?: LucideIcon;
  tone?: Tone;
  leading?: ReactNode;
  title: ReactNode;
  /** Wraps to as many lines as it needs: nothing is cut off. */
  sub?: ReactNode;
  trailing?: ReactNode;
  /** A chevron tells the row opens something. Links show it by default. */
  chevron?: boolean;
  to?: string;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * One row in a list: tile, title and sub-text, something at the end. Every row of a kind looks the
 * same whether it's a link, a button or a plain line, so lists read as one piece.
 */
export const ListRow = forwardRef<HTMLElement, ListRowProps>(function ListRow({ icon: Icon, tone = 'brand', leading, title, sub, trailing, chevron, to, onClick, selected, disabled, className = '', ...aria }, ref) {
  const interactive = !!(to || onClick);
  const base = `flex min-h-[64px] w-full items-center gap-4 px-5 py-3 text-start ${interactive ? 'pressable hover:bg-surface-2 active:bg-surface-3' : ''} ${selected ? 'bg-brand-softer' : ''} ${disabled ? 'pointer-events-none opacity-45' : ''} ${className}`;
  const body = (
    <>
      {leading ?? (Icon && <IconTile icon={Icon} tone={tone} />)}
      <span className="min-w-0 flex-1">
        <span className="block text-md font-semibold">{title}</span>
        {sub && <span className="block text-sm text-ink-2">{sub}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
      {(chevron ?? !!to) && <ChevronRight size={20} className="-me-1 shrink-0 text-ink-3 rtl:rotate-180" aria-hidden />}
    </>
  );
  if (to) {
    return (
      <Link ref={ref as React.Ref<HTMLAnchorElement>} to={to} className={base} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} {...aria}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button ref={ref as React.Ref<HTMLButtonElement>} type="button" onClick={onClick} disabled={disabled} className={base} {...aria}>
        {body}
      </button>
    );
  }
  return (
    <div ref={ref as React.Ref<HTMLDivElement>} className={base} {...aria}>
      {body}
    </div>
  );
});

/** A setting's row: label and hint at the start, the control at the end (or under, when `stack`). */
export function FormRow({ label, hint, children, stack, className = '' }: { label: ReactNode; hint?: ReactNode; children?: ReactNode; stack?: boolean; className?: string }) {
  return (
    <div className={`flex min-h-[60px] gap-x-4 gap-y-3 px-5 py-3 ${stack ? 'flex-col sm:flex-row sm:items-center sm:justify-between' : 'items-center justify-between'} ${className}`}>
      <div className="min-w-0">
        <div className="text-md font-medium">{label}</div>
        {hint && <div className="text-sm text-ink-2">{hint}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

/** A row that opens a picker: the label, the current value, a chevron. */
export function PickerRow({ label, value, hint, onClick, to, className = '' }: { label: ReactNode; value: ReactNode; hint?: ReactNode; onClick?: () => void; to?: string; className?: string }) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-md font-medium">{label}</span>
        {hint && <span className="block text-sm text-ink-2">{hint}</span>}
      </span>
      <span className="min-w-0 max-w-[50%] truncate text-end text-base text-ink-2">{value}</span>
      <ChevronRight size={20} className="-me-1 shrink-0 text-ink-3 rtl:rotate-180" aria-hidden />
    </>
  );
  const cls = `pressable flex min-h-[60px] w-full items-center gap-3 px-5 py-3 text-start hover:bg-surface-2 active:bg-surface-3 ${className}`;
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** The on/off switch, on its own row. */
export function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <FormRow label={label} hint={hint}>
      <label className={`relative inline-flex items-center ${disabled ? 'opacity-45' : 'cursor-pointer'}`}>
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
        <span className="h-[31px] w-[51px] rounded-full bg-surface-3 transition-colors duration-[var(--dur-base)] peer-checked:bg-good peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface" />
        <span className="absolute start-[2px] top-[2px] size-[27px] rounded-full bg-white shadow-2 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] peer-checked:translate-x-[20px] rtl:peer-checked:-translate-x-[20px]" />
      </label>
    </FormRow>
  );
}

/** Nothing here yet, or something went wrong: says so, and what to do next. `dashed` draws it as an open slot. */
export function EmptyState({ icon, title, children, action, dashed, className = '' }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; dashed?: boolean; className?: string }) {
  return (
    <div className={`${dashed ? CARD_DASHED : CARD} ${className}`}>
      <PanelNote icon={icon} title={title} action={action}>
        {children}
      </PanelNote>
    </div>
  );
}

/** The field every screen filters with: a search icon, a clear button once there's text. */
export const SearchField = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { value: string; onChange: (v: string) => void; label: string; className?: string }>(function SearchField({ value, onChange, label, className = '', ...rest }, ref) {
  return (
    <div className={`relative ${className}`}>
      <Search size={18} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        placeholder={rest.placeholder ?? label}
        autoComplete="off"
        className="h-12 w-full rounded-[var(--radius-m)] bg-surface ps-12 pe-12 text-base text-ink shadow-card outline-none transition-shadow placeholder:text-ink-3 focus:ring-2 focus:ring-brand [&::-webkit-search-cancel-button]:hidden"
        {...rest}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label={t('Clear')} className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink">
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );
});

/** A quiet circular icon button for headers (back, close, more). 44pt target. */
export const CircleButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; size?: number }>(function CircleButton({ icon: Icon, label, size = 44, className = '', ...rest }, ref) {
  return (
    <button ref={ref} type="button" aria-label={label} title={label} style={{ width: size, height: size }} className={`pressable inline-flex shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3 hover:text-ink disabled:pointer-events-none disabled:opacity-35 ${className}`} {...rest}>
      <Icon size={20} aria-hidden />
    </button>
  );
});
