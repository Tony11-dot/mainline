import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, PenLine, Repeat2 } from 'lucide-react';
import { useStore } from 'zustand';
import { nextPath, nodeAt } from '@mainline/shared';
import { MoveInput } from './MoveInput';
import type { AnalysisStore } from './analysis';
import { IconButton } from '../ui/primitives';

export function BoardControls({ store, drawMode, onToggleDraw, children, onTypedMove }: { store: AnalysisStore; drawMode?: boolean; onToggleDraw?: () => void; children?: React.ReactNode; onTypedMove?: (uci: string) => void }) {
  const path = useStore(store, (s) => s.path);
  const root = useStore(store, (s) => s.root);
  useStore(store, (s) => s.version);
  const s = store.getState();
  const atStart = !path;
  const atEnd = nextPath(root, path) === undefined;
  return (
    <div className="flex items-center justify-between gap-1 px-2 py-1.5">
      <div className="flex items-center gap-0.5">
        <IconButton icon={Repeat2} label="Flip board (F)" onClick={s.flip} />
        {onToggleDraw && <IconButton icon={PenLine} label={drawMode ? 'Stop drawing' : 'Draw arrows'} active={drawMode} onClick={onToggleDraw} />}
        {children}
        <span className="ml-1 hidden md:inline-flex">
          <MoveInput fen={nodeAt(root, path)?.fen ?? root.fen} onMove={(u) => (onTypedMove ? onTypedMove(u) : store.getState().play(u))} />
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <IconButton icon={ChevronFirst} label="First move (↑)" onClick={s.first} disabled={atStart} />
        <IconButton icon={ChevronLeft} label="Previous move (←)" onClick={s.prev} disabled={atStart} />
        <IconButton icon={ChevronRight} label="Next move (→)" onClick={s.next} disabled={atEnd} />
        <IconButton icon={ChevronLast} label="Last move (↓)" onClick={s.last} disabled={atEnd} />
      </div>
    </div>
  );
}
