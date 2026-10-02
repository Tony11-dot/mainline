import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, PenLine, Repeat2 } from 'lucide-react';
import { useStore } from 'zustand';
import { nextPath, nodeAt } from '@mainline/shared';
import { MoveInput } from './MoveInput';
import type { AnalysisStore } from './analysis';
import { IconButton } from '../ui/primitives';
import { t } from '../lib/i18n';

export function BoardControls({ store, drawMode, onToggleDraw, children, onTypedMove }: { store: AnalysisStore; drawMode?: boolean; onToggleDraw?: () => void; children?: React.ReactNode; onTypedMove?: (uci: string) => void }) {
  const path = useStore(store, (s) => s.path);
  const root = useStore(store, (s) => s.root);
  useStore(store, (s) => s.version);
  const s = store.getState();
  const atStart = !path;
  const atEnd = nextPath(root, path) === undefined;
  return (
    // The board never mirrors, so neither do its controls (first / previous / next / last).
    <div dir="ltr" className="flex items-center justify-between gap-1 px-2 py-1.5">
      <div className="flex items-center gap-0.5">
        <IconButton icon={Repeat2} label={t('Flip board (F)')} onClick={s.flip} />
        {onToggleDraw && <IconButton icon={PenLine} label={drawMode ? t('Stop drawing') : t('Draw arrows')} active={drawMode} onClick={onToggleDraw} />}
        {children}
        <span className="ms-1 hidden md:inline-flex">
          <MoveInput fen={nodeAt(root, path)?.fen ?? root.fen} onMove={(u) => (onTypedMove ? onTypedMove(u) : store.getState().play(u))} />
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <IconButton icon={ChevronFirst} label={t('First move (↑)')} onClick={s.first} disabled={atStart} />
        <IconButton icon={ChevronLeft} label={t('Previous move (←)')} onClick={s.prev} disabled={atStart} />
        <IconButton icon={ChevronRight} label={t('Next move (→)')} onClick={s.next} disabled={atEnd} />
        <IconButton icon={ChevronLast} label={t('Last move (↓)')} onClick={s.last} disabled={atEnd} />
      </div>
    </div>
  );
}
