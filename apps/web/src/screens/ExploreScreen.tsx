import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { useSearchParams } from 'react-router';
import { INITIAL_FEN } from '@mainline/shared';
import type { Key } from 'chessground/types';
import type { DrawShape } from 'chessground/draw';
import { Board } from '../board/Board';
import { BoardControls } from '../board/BoardControls';
import { bindAnalysisKeys, createAnalysisStore, useBoardView, type AnalysisStore } from '../board/analysis';
import { useOpeningName } from '../board/useOpeningName';
import { EvalBar } from '../panels/EvalBar';
import { EnginePanel } from '../panels/EnginePanel';
import { ExplorerPanel } from '../panels/ExplorerPanel';
import { MoveTree } from '../panels/MoveTree';
import { useEngineEval } from '../panels/useEngineEval';
import { usePrefs } from '../lib/prefs';
import { Segmented } from '../ui/primitives';
import { useMediaQuery } from '../ui/useMediaQuery';

const exploreStore = createAnalysisStore();

type Pane = 'moves' | 'explorer' | 'engine';

export function ExploreScreen({ store = exploreStore }: { store?: AnalysisStore }) {
  const view = useBoardView(store);
  const orientation = useStore(store, (s) => s.orientation);
  const engineOn = usePrefs((s) => s.engineOn);
  const ev = useEngineEval(view.node.fen, engineOn);
  const opening = useOpeningName(view.nodes.map((n) => n.fen));
  const [hoverUci, setHoverUci] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [pane, setPane] = useState<Pane>('explorer');
  const wide = useMediaQuery('(min-width: 1024px)');

  const [params] = useSearchParams();
  useEffect(() => {
    const fen = params.get('fen');
    const moves = params.get('moves');
    if (!fen && !moves) return;
    try {
      store.getState().reset(fen ?? INITIAL_FEN, moves ? moves.split(/[ ,]+/).filter(Boolean) : []);
      const color = params.get('color');
      if (color === 'white' || color === 'black') store.getState().setOrientation(color);
    } catch {
      /* ignore malformed links */
    }
  }, [params, store]);

  useEffect(() => bindAnalysisKeys(store), [store]);
  useEffect(() => setHoverUci(null), [view.path]);

  const autoShapes = useMemo<DrawShape[]>(() => {
    const shapes: DrawShape[] = [];
    const best = ev.lines[0]?.moves[0];
    if (engineOn && best && !hoverUci) shapes.push({ orig: best.slice(0, 2) as Key, dest: best.slice(2, 4) as Key, brush: 'paleBlue' });
    if (hoverUci) shapes.push({ orig: hoverUci.slice(0, 2) as Key, dest: hoverUci.slice(2, 4) as Key, brush: 'blue' });
    return shapes;
  }, [ev.lines, engineOn, hoverUci]);

  const s = store.getState();
  const playLine = (ucis: string[]) => ucis.forEach((u) => s.play(u));

  const board = (
    <Board
      fen={view.node.fen}
      orientation={orientation}
      turnColor={view.turn}
      movable="both"
      dests={view.dests}
      lastMove={view.lastMove}
      check={view.check}
      shapes={view.node.shapes as DrawShape[] | undefined}
      autoShapes={autoShapes}
      onShapesChange={(sh) => s.setShapes(sh)}
      onMove={(uci) => s.play(uci)}
      drawMode={drawMode}
      ariaLabel={`Board. ${view.turn} to move.`}
    />
  );

  const header = (
    <div className="flex min-h-[44px] items-center gap-2 px-4 lg:px-0">
      {opening ? (
        <>
          <span className="tnum rounded-[6px] bg-surface-3 px-1.5 py-0.5 text-xs font-bold text-ink-2">{opening.eco}</span>
          <h1 className="truncate text-md font-semibold">{opening.name}</h1>
        </>
      ) : (
        <h1 className="text-md font-semibold text-ink-2">{view.path ? 'Unnamed position' : 'Starting position'}</h1>
      )}
    </div>
  );

  if (wide) {
    return (
      <div className="mx-auto flex max-w-[1400px] gap-5 px-6 py-5">
        <div className="flex min-w-0 flex-col" style={{ width: 'min(calc(100dvh - 7.5rem), calc(100% - 420px))' }}>
          {header}
          <div className="mt-2 flex gap-2.5">
            {engineOn && <EvalBar line={ev.lines[0]} orientation={orientation} className="self-stretch" />}
            <div className="min-w-0 flex-1">{board}</div>
          </div>
          <BoardControls store={store} />
        </div>
        <aside className="flex max-h-[calc(100dvh-2.5rem)] min-w-[340px] max-w-[460px] flex-1 flex-col gap-3 overflow-hidden">
          <div className="rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
            <EnginePanel fen={view.node.fen} view={ev} onPlayLine={playLine} onHoverMove={setHoverUci} />
          </div>
          <div className="min-h-[120px] shrink-0 overflow-auto rounded-[var(--radius-l)] border border-line bg-surface shadow-1" style={{ maxHeight: '34%' }}>
            <MoveTree store={store} />
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
            <ExplorerPanel fen={view.node.fen} onPlay={(u) => s.play(u)} onHoverMove={setHoverUci} />
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col">
      {header}
      {engineOn && <EvalBar line={ev.lines[0]} orientation={orientation} direction="horizontal" className="mx-0 rounded-none" />}
      <div className="mx-auto w-full" style={{ maxWidth: 'calc(100dvh - 14rem)' }}>
        {board}
      </div>
      <BoardControls store={store} drawMode={drawMode} onToggleDraw={() => setDrawMode((d) => !d)} />
      <div className="px-3">
        <Segmented
          label="Panel"
          value={pane}
          onChange={setPane}
          options={[
            { value: 'explorer', label: 'Explorer' },
            { value: 'moves', label: 'Moves' },
            { value: 'engine', label: 'Engine' },
          ]}
        />
      </div>
      <div className="mt-2 min-h-[240px]">
        {pane === 'moves' && <MoveTree store={store} />}
        {pane === 'explorer' && <ExplorerPanel fen={view.node.fen} onPlay={(u) => s.play(u)} />}
        {pane === 'engine' && <EnginePanel fen={view.node.fen} view={ev} onPlayLine={playLine} />}
      </div>
    </div>
  );
}
