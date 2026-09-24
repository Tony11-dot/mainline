import { create } from 'zustand';
import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'error';
  action?: { label: string; run: () => void | Promise<void> };
}
interface ToastState {
  toasts: Toast[];
  show: (t: Omit<Toast, 'id'>, ms?: number) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  show: (t, ms = t.action ? 8000 : 5000) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => get().dismiss(id), ms);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = (text: string, opts: Partial<Omit<Toast, 'id' | 'text'>> = {}) => useToasts.getState().show({ text, kind: opts.kind ?? 'info', action: opts.action });

/** Deleted something? Offer undo. */
export const undoToast = (text: string, undo: () => void | Promise<void>) => toast(text, { action: { label: 'Undo', run: undo } });

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  useEffect(() => undefined, []);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[var(--z-toast)] flex flex-col items-center gap-2 px-4"
      style={{ bottom: 'calc(var(--safe-bottom) + var(--tabbar-h) + 22px)' }}
    >
      {toasts.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info;
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-[14px] bg-[oklch(0.22_0.015_262)] py-2.5 pl-3.5 pr-2 text-sm text-white shadow-3 animate-[toast-in_220ms_var(--ease-out)]"
          >
            <Icon size={17} className={t.kind === 'error' ? 'text-[oklch(0.75_0.15_25)]' : t.kind === 'success' ? 'text-[oklch(0.8_0.15_150)]' : 'text-[oklch(0.8_0.08_262)]'} aria-hidden />
            <span className="min-w-0 flex-1">{t.text}</span>
            {t.action && (
              <button
                type="button"
                className="h-8 rounded-[9px] px-3 font-semibold text-[oklch(0.82_0.1_262)] hover:bg-white/10"
                onClick={() => {
                  void t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
