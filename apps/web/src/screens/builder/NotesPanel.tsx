import { useEffect, useRef, useState } from 'react';
import type { RepMove } from '@mainline/shared';
import { PanelNote } from '../../ui/primitives';

export function NotesPanel({ move, onSave }: { move?: RepMove; onSave: (note: string) => void | Promise<void> }) {
  const [text, setText] = useState(move?.note ?? '');
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!move) return <PanelNote title="Select a move">Notes and arrows are saved on moves. Step into the line to add one.</PanelNote>;
  return (
    <div className="p-3">
      <label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-ink-2">
        <span>Note on {move.san}</span>
        <span className="text-xs font-normal text-ink-3" aria-live="polite">{saved ? 'Saved' : 'Saving…'}</span>
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
        placeholder="Why this move? What's the plan? (shown during training)"
        className="h-36 w-full resize-y rounded-[12px] border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-3 focus:ring-brand/20"
      />
      <p className="mt-2 text-xs text-ink-3">Tip: draw arrows on the board (right-drag, or long-press on touch) — they're saved with this move.</p>
    </div>
  );
}
