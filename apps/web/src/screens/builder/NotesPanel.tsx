import { useEffect, useRef, useState } from 'react';
import type { RepMove } from '@mainline/shared';
import { PanelNote } from '../../ui/primitives';
import { t } from '../../lib/i18n';

export function NotesPanel({ move, onSave }: { move?: RepMove; onSave: (note: string) => void | Promise<void> }) {
  const [text, setText] = useState(move?.note ?? '');
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!move) return <PanelNote title={t('Select a move')}>{t('Notes and arrows are saved on moves. Step into the line to add one.')}</PanelNote>;
  return (
    <div className="p-4">
      <label className="mb-2 flex items-center justify-between text-md font-bold">
        <span>{t('Note on {move}', { move: move.san })}</span>
        <span className="text-sm font-normal text-ink-2" aria-live="polite">{saved ? t('Saved') : t('Saving…')}</span>
      </label>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
          clearTimeout(timer.current);
          timer.current = setTimeout(async () => {
            await onSave(e.target.value);
            setSaved(true);
          }, 500);
        }}
        placeholder={t('Why this move? What’s the plan? (shown during training)')}
        className="h-36 w-full resize-y rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-base outline-none focus:border-brand focus:ring-3 focus:ring-brand/20"
      />
      <p className="mt-2.5 text-sm text-ink-2">{t('Tip: draw arrows on the board (right-drag, or long-press on touch) — they’re saved with this move.')}</p>
    </div>
  );
}
