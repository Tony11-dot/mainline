import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  onSelect: () => void;
}

/** Popover menu anchored to its trigger; rendered position:fixed so containers can't clip it. */
export function Menu({ trigger, items, label }: { trigger: (props: { onClick: (e: React.MouseEvent) => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode; items: MenuItem[]; label: string }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const m = ref.current.getBoundingClientRect();
    const top = anchor.bottom + 6 + m.height > innerHeight - 8 ? anchor.top - m.height - 6 : anchor.bottom + 6;
    const left = Math.min(Math.max(8, anchor.right - m.width), innerWidth - m.width - 8);
    setPos({ top, left });
    ref.current.querySelector<HTMLButtonElement>('button')?.focus();
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.type === 'pointerdown' && ref.current?.contains(e.target as Node)) return;
      setAnchor(null);
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', close);
      window.removeEventListener('resize', close);
    };
  }, [anchor]);

  return (
    <>
      {trigger({
        onClick: (e) => {
          e.stopPropagation();
          e.preventDefault();
          setAnchor(anchor ? null : (e.currentTarget as HTMLElement).getBoundingClientRect());
        },
        'aria-expanded': !!anchor,
        'aria-haspopup': 'menu',
      })}
      {anchor && (
        <div
          ref={ref}
          role="menu"
          aria-label={label}
          className="fixed z-[var(--z-tooltip)] min-w-[200px] overflow-hidden rounded-[14px] border border-line bg-surface p-1 shadow-3 animate-[toast-in_140ms_var(--ease-out)]"
          style={pos}
          onKeyDown={(e) => {
            const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
            const i = btns.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === 'ArrowDown') btns[(i + 1) % btns.length]?.focus();
            if (e.key === 'ArrowUp') btns[(i - 1 + btns.length) % btns.length]?.focus();
          }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setAnchor(null);
                it.onSelect();
              }}
              className={`flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-base font-medium outline-none hover:bg-surface-3 focus-visible:bg-surface-3 ${it.danger ? 'text-bad' : 'text-ink'}`}
            >
              {it.icon && <it.icon size={17} aria-hidden className={it.danger ? '' : 'text-ink-2'} />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
