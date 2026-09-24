import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useStore } from 'zustand';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { ArrowLeft, Crown, Lightbulb, Sparkles, Star, Trash2, Waypoints } from 'lucide-react';
import { addLine, buildGraph, childPath, pathToUcis, findConflicts, isOwnTurn, mainMoveAt, nodeAt, parentPath, playUci, positionFromFen, uciToSan, epdToFen } from '@mainline/shared';
import { Board } from '../board/Board';
import { BoardControls } from '../board/BoardControls';
import { bindAnalysisKeys, createAnalysisStore, locate, useBoardView } from '../board/analysis';
import { useOpeningName } from '../board/useOpeningName';
import { EvalBar } from '../panels/EvalBar';
import { EnginePanel } from '../panels/EnginePanel';
import { ExplorerPanel } from '../panels/ExplorerPanel';
import { MoveTree } from '../panels/MoveTree';
import { useEngineEval } from '../panels/useEngineEval';
import { folderPath, repMoves, useLibrary } from '../lib/library';
import { pathToEpd, repertoireTree, validPrefix } from '../lib/repTree';
import { usePrefs } from '../lib/prefs';
import { Button, PanelNote } from '../ui/primitives';
import { MoveStatsPanel } from '../panels/MoveStatsPanel';
import { CoachPanel } from '../panels/CoachPanel';
import { InsightsPanel } from '../panels/InsightsPanel';
import { toast, undoToast } from '../ui/toast';
import { useMediaQuery } from '../ui/useMediaQuery';
import { AutoBuildSheet } from './builder/AutoBuildSheet';
import { SuggestPanel } from './builder/SuggestPanel';
import { NotesPanel } from './builder/NotesPanel';

type Pane = 'tree' | 'explorer' | 'engine' | 'stats' | 'coach' | 'notes' | 'suggest' | 'insights';

export function RepertoireScreen() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const lib = useLibrary();
  useEffect(() => void lib.load(), [lib]);
  const rep = lib.reps.find((r) => r.id === id && !r.deleted);
  const store = useMemo(() => createAnalysisStore(), []);
  const initialised = useRef(false);
  /** Paths played optimistically whose IndexedDB write hasn't been reflected in a rebuild yet. */
  const pendingPaths = useRef(new Set<string>());

  // (Re)build the tree whenever the library changes; keep the user where they were.
  useEffect(() => {
    if (!rep) return;
    const root = repertoireTree(rep, repMoves(lib.moves, rep.id));
    const s = store.getState();
    let path = validPrefix(root, s.path);
    // A rebuild from an earlier write can arrive before the latest optimistic move is saved: replay it.
    for (const p of [...pendingPaths.current]) {
      if (nodeAt(root, p)) pendingPaths.current.delete(p);
    }
    if (path !== s.path && [...pendingPaths.current].some((p) => s.path.startsWith(p) || p.startsWith(s.path))) {
      try {
        path = addLine(root, path, pathToUcis(s.path).slice(pathToUcis(path).length));
      } catch {
        /* position no longer valid — keep the prefix */
      }
    }
    if (!initialised.current) {
      initialised.current = true;
      store.getState().setOrientation(rep.color);
      const at = params.get('at');
      if (at) path = pathToEpd(root, at) ?? path;
    }
    store.setState({ root, path, version: s.version + 1 });
  }, [lib.version, rep?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => bindAnalysisKeys(store), [store]);

  const view = useBoardView(store);
  const orientation = useStore(store, (s) => s.orientation);
  const engineOn = usePrefs((s) => s.engineOn);
  const ev = useEngineEval(view.node.fen, engineOn);
  const opening = useOpeningName(view.nodes.map((n) => n.fen));
  const [hoverUci, setHoverUci] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [pane, setPane] = useState<Pane>('tree');
  const [autoOpen, setAutoOpen] = useState(false);
  const wide = useMediaQuery('(min-width: 1024px)');

  const moves = useMemo(() => (rep ? repMoves(lib.moves, rep.id) : []), [lib.version, rep?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const graph = useMemo(() => buildGraph(moves), [moves]);
  const here = graph.get(view.node.epd) ?? [];
  const own = rep ? isOwnTurn(rep.color, view.node.epd) : false;
  const main = own ? mainMoveAt(graph, view.node.epd) : undefined;
  const conflict = useMemo(() => {
    if (!rep || !own) return undefined;
    return findConflicts(lib.reps.filter((r) => !r.deleted && r.color === rep.color), lib.moves).find((c) => c.epd === view.node.epd);
  }, [lib.version, view.node.epd, own]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentMove = useMemo(() => {
    if (!view.path) return undefined;
    const parent = nodeAt(view.root, parentPath(view.path));
    return parent ? moves.find((m) => m.fromEpd === parent.epd && m.uci === view.node.uci) : undefined;
  }, [view.path, view.root, moves, view.node.uci]);

  const autoShapes = useMemo<DrawShape[]>(() => {
    const out: DrawShape[] = [];
    if (hoverUci) out.push({ orig: hoverUci.slice(0, 2) as Key, dest: hoverUci.slice(2, 4) as Key, brush: 'blue' });
    else if (engineOn && ev.lines[0]?.moves[0]) {
      const b = ev.lines[0].moves[0];
      out.push({ orig: b.slice(0, 2) as Key, dest: b.slice(2, 4) as Key, brush: 'paleBlue' });
    }
    return out;
  }, [hoverUci, engineOn, ev.lines]);

  if (!lib.loaded) return null;
  if (!rep)
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <PanelNote title="This repertoire doesn't exist anymore" action={<Button onClick={() => nav('/library')}>Back to repertoire</Button>}>
          It may have been deleted on another device.
        </PanelNote>
      </div>
    );

  const addMove = async (uci: string, fromFen?: string) => {
    // The move belongs to the position the board showed when it was made (chessground reports moves
    // asynchronously, and navigation may have happened since). Fall back to the live store position.
    const st = store.getState();
    const base = fromFen ? locate(st.root, st.path, fromFen) : st.path;
    const node = nodeAt(st.root, base) ?? st.root;
    const fen = node.fen;
    let played;
    try {
      played = playUci(positionFromFen(fen), uci);
    } catch {
      return;
    }
    if (node.children.some((c) => c.uci === played.uci)) {
      st.goto(childPath(base, played.uci), { sound: true });
      return;
    }
    if (base !== st.path) st.goto(base);
    // Optimistic: the board advances immediately (with sound); IndexedDB catches up in the background
    // and the rebuild keeps this path because the node already exists.
    pendingPaths.current.add(childPath(base, played.uci));
    store.getState().play(played.uci);
    const m = await lib.addMove(rep.id, fen, played.uci);
    const mainHere = useLibrary.getState().moves.find((x) => x.repertoireId === rep.id && !x.deleted && x.fromEpd === m.fromEpd && x.isMainline && x.uci !== m.uci);
    if (!m.isMainline && mainHere) {
      toast(`Added ${m.san} as an alternate — you play ${mainHere.san} here`, { action: { label: 'Make main', run: () => lib.makeMain(rep.id, m.fromEpd, m.uci) } });
    }
  };

  const deleteHere = async () => {
    if (!currentMove) return;
    const undo = await lib.deleteBranch(rep.id, currentMove.fromEpd, currentMove.uci);
    undoToast(`Deleted ${currentMove.san} and everything after it`, undo);
  };

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
      onShapesChange={(sh) => {
        if (currentMove) void lib.setShapes(rep.id, currentMove.fromEpd, currentMove.uci, sh);
      }}
      onMove={(u, f) => void addMove(u, f)}
      drawMode={drawMode}
      ariaLabel={`Repertoire board. ${view.turn} to move.`}
    />
  );

  const status = (
    <div className="flex flex-wrap items-center gap-2">
      {own ? (
        main ? (
          <Chip tone="brand" icon={Crown}>
            You play {main.san}
            {here.length > 1 ? ` · ${here.length - 1} alt` : ''}
          </Chip>
        ) : (
          <Chip tone="warn" icon={Lightbulb}>
            Your move — not decided yet
          </Chip>
        )
      ) : (
        <Chip tone="neutral" icon={Waypoints}>
          {here.length ? `${here.length} repl${here.length === 1 ? 'y' : 'ies'} prepared` : 'Their move — no replies yet'}
        </Chip>
      )}
      {conflict && (
        <Chip tone="warn">
          Conflict: {[...conflict.choices.keys()].map((u) => uciToSan(positionFromFen(epdToFen(conflict.epd)), u)).join(' vs ')}
        </Chip>
      )}
    </div>
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      {own && (
        <Button size="sm" icon={Sparkles} onClick={() => setPane('suggest')}>
          Suggest my move
        </Button>
      )}
      <Button size="sm" icon={Waypoints} onClick={() => setAutoOpen(true)}>
        Add popular replies
      </Button>
      {view.node.tags?.includes('alt') && currentMove && (
        <Button size="sm" icon={Star} onClick={() => void lib.makeMain(rep.id, currentMove.fromEpd, currentMove.uci)}>
          Make main move
        </Button>
      )}
      {currentMove && (
        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => void deleteHere()} className="text-bad hover:text-bad">
          Delete from here
        </Button>
      )}
    </div>
  );

  const repUcis = new Set(here.map((m) => m.uci));
  const parentNode = view.path ? nodeAt(view.root, parentPath(view.path)) : undefined;
  const panes: Record<Pane, React.ReactNode> = {
    tree: <MoveTree store={store} emptyHint={own ? 'Play your first move on the board.' : 'Play the moves you expect from your opponent.'} />,
    explorer: <ExplorerPanel fen={view.node.fen} onPlay={(u) => void addMove(u)} onHoverMove={setHoverUci} highlightUcis={repUcis} />,
    engine: <EnginePanel fen={view.node.fen} view={ev} onPlayLine={(ucis) => ucis[0] && void addMove(ucis[0])} onHoverMove={setHoverUci} />,
    notes: <NotesPanel key={currentMove ? `${currentMove.fromEpd}${currentMove.uci}` : 'root'} move={currentMove} onSave={(note) => currentMove && lib.setNote(rep.id, currentMove.fromEpd, currentMove.uci, note)} />,
    stats: <MoveStatsPanel parentFen={parentNode?.fen} uci={view.node.uci || undefined} color={rep.color} />,
    coach: (
      <CoachPanel
        fen={view.node.fen}
        parentFen={parentNode?.fen}
        moveUci={view.node.uci || undefined}
        lineUcis={pathToUcis(view.path)}
        lineStartFen={view.root.fen}
        onMove={(u) => void addMove(u)}
        onHover={setHoverUci}
      />
    ),
    insights: <InsightsPanel rep={rep} onOpen={(epd) => { const p = pathToEpd(view.root, epd); if (p !== undefined) store.getState().goto(p); }} />,
    suggest: own ? <SuggestPanel fen={view.node.fen} color={rep.color} engineLines={ev.lines} onPick={(u) => void addMove(u)} onHover={setHoverUci} /> : <PanelNote title="Suggestions are for your moves">Step to a position where it's your turn.</PanelNote>,
  };
  const paneOptions = [
    { value: 'tree' as const, label: 'Moves' },
    { value: 'explorer' as const, label: 'Explorer' },
    { value: 'engine' as const, label: 'Engine' },
    { value: 'stats' as const, label: 'Stats' },
    { value: 'coach' as const, label: 'Coach' },
    ...(own ? [{ value: 'suggest' as const, label: 'Suggest' }] : []),
    { value: 'notes' as const, label: 'Notes' },
    { value: 'insights' as const, label: 'Coverage' },
  ];
  const activePane = pane === 'suggest' && !own ? 'tree' : pane;

  const header = (
    <div className="flex min-h-[44px] items-center gap-2 px-4 lg:px-0">
      <Link to="/library" className="-ml-2 flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3" aria-label="Back to repertoire">
        <ArrowLeft size={20} />
      </Link>
      <div className="min-w-0">
        <h1 className="truncate text-md font-bold">{rep.name}</h1>
        <p className="truncate text-xs text-ink-3">
          {folderPath(lib.folders, rep.folderId).join(' / ')}
          {opening ? ` · ${opening.eco} ${opening.name}` : ''}
        </p>
      </div>
    </div>
  );

  const sheet = <AutoBuildSheet open={autoOpen} onClose={() => setAutoOpen(false)} repId={rep.id} color={rep.color} startFen={view.node.fen} />;

  if (wide) {
    return (
      <div className="mx-auto flex max-w-[1400px] gap-5 px-6 py-5">
        <div className="flex min-w-0 flex-col" style={{ width: 'min(calc(100dvh - 7.5rem), calc(100% - 440px))' }}>
          {header}
          <div className="mt-2 flex gap-2.5">
            {engineOn && <EvalBar line={ev.lines[0]} orientation={orientation} className="self-stretch" />}
            <div className="min-w-0 flex-1">{board}</div>
          </div>
          <BoardControls store={store} />
        </div>
        <aside className="flex max-h-[calc(100dvh-2.5rem)] min-w-[360px] max-w-[480px] flex-1 flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-[var(--radius-l)] border border-line bg-surface p-3.5 shadow-1">
            {status}
            {actions}
          </div>
          <PaneTabs value={activePane} onChange={setPane} options={paneOptions} />
          <div className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-l)] border border-line bg-surface shadow-1">{panes[activePane]}</div>
        </aside>
        {sheet}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col">
      {header}
      {engineOn && <EvalBar line={ev.lines[0]} orientation={orientation} direction="horizontal" className="rounded-none" />}
      <div className="mx-auto w-full" style={{ maxWidth: 'calc(100dvh - 15rem)' }}>
        {board}
      </div>
      <BoardControls store={store} drawMode={drawMode} onToggleDraw={() => setDrawMode((d) => !d)} />
      <div className="flex flex-col gap-2.5 px-3 pb-3">
        {status}
        <div className="-mx-3 overflow-x-auto px-3 [scrollbar-width:none]">{actions}</div>
      </div>
      <div className="px-3">
        <PaneTabs value={activePane} onChange={setPane} options={paneOptions} />
      </div>
      <div className="mt-2 min-h-[240px]">{panes[activePane]}</div>
      {sheet}
    </div>
  );
}

function Chip({ tone, icon: Icon, children }: { tone: 'brand' | 'warn' | 'neutral'; icon?: typeof Crown; children: React.ReactNode }) {
  const tones = { brand: 'bg-brand-soft text-brand-ink', warn: 'bg-warn-soft text-[oklch(0.45_0.1_70)] dark:text-warn', neutral: 'bg-surface-3 text-ink-2' };
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold ${tones[tone]}`}>
      {Icon && <Icon size={14} aria-hidden />}
      {children}
    </span>
  );
}

/** Scrollable pill tabs — the builder has more panels than fit a segmented control on phones. */
function PaneTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="tablist" aria-label="Panel" className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors ${o.value === value ? 'bg-brand text-on-brand' : 'bg-surface-3 text-ink-2 hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
