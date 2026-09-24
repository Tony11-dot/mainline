import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Native <dialog>: a bottom sheet on phones, a centered panel on larger screens.
 * Escape and backdrop tap close it; focus is trapped by the browser.
 */
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={`sheet m-0 mt-auto w-full max-w-none rounded-t-[var(--radius-xl)] border border-line bg-surface p-0 text-ink shadow-3 backdrop:bg-[oklch(0.2_0.02_262/0.35)] backdrop:backdrop-blur-[2px] sm:m-auto sm:rounded-[var(--radius-xl)] ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
    >
      {open && (
        <div className="flex max-h-[88dvh] flex-col" style={{ paddingBottom: 'var(--safe-bottom)' }}>
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <header className="flex items-center justify-between gap-3 px-5 pt-3 pb-2 sm:pt-5">
            <h2 className="text-lg font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-ink-2 hover:text-ink">
              <X size={18} />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mt-4 block first:mt-1">
      <span className="mb-1.5 block text-sm font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export const inputCls = 'h-11 w-full rounded-[12px] border border-line bg-surface px-3.5 text-base outline-none transition-shadow placeholder:text-ink-3 focus:border-brand focus:ring-3 focus:ring-brand/20';
