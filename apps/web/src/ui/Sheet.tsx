import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { t } from '../lib/i18n';
import { useOverlay } from './overlay';

/**
 * Native <dialog>: a bottom sheet on phones, a centered panel on larger screens.
 * Escape and backdrop tap close it; focus is trapped by the browser.
 */
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  // The native iOS tab bar floats above the web view and would cover the footer's buttons.
  useOverlay(open);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // The browser would focus the close button and draw a focus ring on it; start at the title
      // instead (screen readers announce it), unless the sheet marks a field with data-autofocus (React's autoFocus runs before the dialog is shown).
      (d.querySelector<HTMLElement>('[data-autofocus]') ?? d.querySelector<HTMLElement>('h2[tabindex]'))?.focus();
    }
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
      className={`sheet m-0 mt-auto w-full max-w-none rounded-t-[var(--radius-xl)] border border-transparent bg-surface p-0 text-ink shadow-3 backdrop:bg-scrim backdrop:backdrop-blur-[2px] sm:m-auto sm:rounded-[var(--radius-xl)] dark:border-line ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
    >
      {open && (
        <div className="flex max-h-[88dvh] flex-col" style={{ paddingBottom: 'var(--safe-bottom)' }}>
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <header className="flex items-center justify-between gap-3 ps-6 pe-3 pt-3 pb-2 sm:pt-4">
            <h2 tabIndex={-1} className="min-w-0 text-xl font-bold outline-none">{title}</h2>
            <button type="button" onClick={onClose} aria-label={t('Close')} className="pressable flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:text-ink">
              <span className="flex size-8 items-center justify-center rounded-full bg-surface-3">
                <X size={17} strokeWidth={2.4} aria-hidden />
              </span>
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-auto px-6 pb-5">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-3.5">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function Field({ label, children, hint, group }: { label: string; children: ReactNode; hint?: string; /** A set of buttons: a <label> would pass its clicks to the first one. */ group?: boolean }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="mt-4 block first:mt-1" {...(group ? { role: 'group', 'aria-label': label } : {})}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </Tag>
  );
}

export const inputCls = 'h-12 w-full rounded-[var(--radius-control)] border border-line bg-surface px-4 text-base text-ink outline-none transition-shadow placeholder:text-ink-3 focus:border-brand focus:ring-3 focus:ring-brand/20';
