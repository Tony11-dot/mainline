import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MenuItem } from './Menu';

/** A menu at the pointer (right-click), kept on screen; closes on outside press, Escape, scroll or resize. */
export function ContextMenu({ at, items, label, onClose }: { at: { x: number; y: number } | null; items: (MenuItem | 'sep')[]; label: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!at || !ref.current) return;
    const m = ref.current.getBoundingClientRect();
    setPos({ top: Math.min(at.y, innerHeight - m.height - 8), left: Math.min(at.x, innerWidth - m.width - 8) });
    ref.current.querySelector<HTMLButtonElement>('button')?.focus();
  }, [at]);
  useEffect(() => {
    if (!at) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.type === 'pointerdown' && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [at, onClose]);
  if (!at) return null;
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className="fixed z-[var(--z-tooltip)] min-w-[220px] overflow-hidden rounded-[12px] border border-line bg-surface p-1 shadow-3 animate-[toast-in_120ms_var(--ease-out)]"
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === 'ArrowDown') btns[(i + 1) % btns.length]?.focus();
        if (e.key === 'ArrowUp') btns[(i - 1 + btns.length) % btns.length]?.focus();
      }}
    >
      {items.map((it, i) =>
        it === 'sep' ? (
          <div key={`sep${i}`} className="my-1 h-px bg-line" role="separator" />
        ) : (
          <button
            key={it.label}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              it.onSelect();
            }}
            className={`flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-start text-sm font-medium outline-none hover:bg-surface-3 focus-visible:bg-surface-3 ${it.danger ? 'text-bad' : 'text-ink'}`}
          >
            {it.icon && <it.icon size={16} aria-hidden className={it.danger ? '' : 'text-ink-2'} />}
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}
