import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useStore } from 'zustand';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { ArrowLeft, Compass, Crown, Lightbulb, Pencil, Sparkles, Star, Unlock, Waypoints } from 'lucide-react';
import { addLine, buildGraph, isReadyMade, myMovesByPosition, bundleEngine, childPath, pathToUcis, findConflicts, guideCandidates, guideMoves, guideReply, GUIDE_MIN_DEPTH, type GuideCandidate, isOwnTurn, mergeEngine, mainMoveAt, nodeAt, parentPath, playUci, positionFromFen, uciToSan, epdToFen } from '@mainline/shared';
import { Board } from '../board/Board';
import { BoardControls } from '../board/BoardControls';
import { bindAnalysisKeys, createAnalysisStore, locate, useBoardView } from '../board/analysis';
import { useOpeningName } from '../board/useOpeningName';
import { EvalBar } from '../panels/EvalBar';
import { EnginePanel } from '../panels/EnginePanel';
import { ExplorerPanel } from '../panels/ExplorerPanel';
import { MoveTree } from '../panels/MoveTree';
import { useEngineEval } from '../panels/useEngineEval';
import { engine as stockfish } from '../lib/engine';
import { folderPath, repMoves, repsUnder, useLibrary } from '../lib/library';
import { pathToEpd, repertoireTree, validPrefix } from '../lib/repTree';
import { usePrefs } from '../lib/prefs';
import { useAssistant } from '../lib/assistant';
import { useGames } from '../lib/games';
import { Button, PanelNote } from '../ui/primitives';
import { MoveStatsPanel } from '../panels/MoveStatsPanel';
import { RepertoireStats } from '../panels/RepertoireStats';
import { CoachPanel } from '../panels/CoachPanel';
import { InsightsPanel } from '../panels/InsightsPanel';
import { toast, undoToast } from '../ui/toast';
import { SPLIT_LAYOUT, useMediaQuery } from '../ui/useMediaQuery';
import { AutoBuildSheet } from './builder/AutoBuildSheet';
import { SuggestPanel } from './builder/SuggestPanel';
import { NotesPanel } from './builder/NotesPanel';
import { GuidePanel, TAG_PIN } from './builder/GuidePanel';
import { LinePanel } from './builder/LinePanel';
import { prefetchGuide, useGuide } from '../lib/guide';
import { PracticeButtons } from './library/practiceUi';
import { t, tn } from '../lib/i18n';

type Pane = 'tree' | 'explorer' | 'engine' | 'stats' | 'coach' | 'notes' | 'suggest' | 'insights';

/** One line: a fresh editor per line, so branching to a new line starts clean. */
export function RepertoireScreen() {
  const { id = '' } = useParams();
  return <LineEditor key={id} id={id} />;
}

function LineEditor({ id }: { id: string }) {
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
      if (params.get('guide') === '1') usePrefs.getState().set({ guided: true });
    }
    store.setState({ root, path, version: s.version + 1 });
  }, [lib.version, rep?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => bindAnalysisKeys(store), [store]);

  const view = useBoardView(store);
  // The AI knows which line you're on and where.
  useEffect(() => {
    if (rep) useAssistant.getState().setFocus({ lineId: rep.id, ucis: [...rep.rootMovesUci, ...pathToUcis(view.path)] });
  }, [rep, view.path]);
  useEffect(() => () => useAssistant.getState().setFocus(undefined), []);
  const orientation = useStore(store, (s) => s.orientation);
  const engineOn = usePrefs((s) => s.engineOn);
  /** Ready-made lines are practised as they are: no guide, no adding, until you take one over. */
  const ready = !!rep && isReadyMade(rep);
  const guided = usePrefs((s) => s.guided) && !ready;
  const ownHere = rep ? isOwnTurn(rep.color, view.node.epd) : false;
  const guideData = useGuide(view.node.fen, guided, true);
  const explorer = { lichess: guideData.bundle?.lichess, masters: guideData.bundle?.masters, loading: guideData.loading && !guideData.bundle };
  const fromBundle = useMemo(() => bundleEngine(guideData.bundle), [guideData.bundle]);
  // Stockfish on the device only fills what the server's evals don't cover: the position's own best
  // moves (needed before anything can be called the engine's pick) or popular moves nobody has analysed.
  // The server usually answers well within a second; when it doesn't, the engine starts rather than
  // leaving the panel empty, and the server's numbers join in when they land.
  const serverSlow = useHeldFor(guideData.loading, 1500);
  const localNeeded =
    guided &&
    (serverSlow ||
      (!guideData.loading &&
        (!guideData.bundle?.eval?.lines.length || guideMoves(guideData.bundle?.lichess, guideData.bundle?.masters, 8).some((u) => !fromBundle.lines.some((l) => l.moves[0] === u) && guideData.bundle?.children?.[u] !== null))));
  const ev = useEngineEval(view.node.fen, engineOn || localNeeded, localNeeded ? 8 : 3);
  // The guide leans on the engine sooner or later: have it loaded before it's needed.
  useEffect(() => {
    if (guided) stockfish.warm();
  }, [guided]);
  const [renaming, setRenaming] = useState(false);
  const opening = useOpeningName(view.nodes.map((n) => n.fen));
  const [hoverUci, setHoverUci] = useState<string | null>(null);
  // A row that moved away under the pointer never sends pointerleave: drop its arrow with the position.
  useEffect(() => setHoverUci(null), [view.path]);
  const [drawMode, setDrawMode] = useState(false);
  const [pane, setPane] = useState<Pane>('tree');
  const [autoOpen, setAutoOpen] = useState(false);
  const wide = useMediaQuery(SPLIT_LAYOUT);

  const moves = useMemo(() => (rep ? repMoves(lib.moves, rep.id) : []), [lib.version, rep?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const graph = useMemo(() => buildGraph(moves), [moves]);
  const here = useMemo(() => graph.get(view.node.epd) ?? [], [graph, view.node.epd]);
  const own = ownHere;
  const main = own ? mainMoveAt(graph, view.node.epd) : undefined;
  const conflict = useMemo(() => {
    if (!rep || !own) return undefined;
    return findConflicts(lib.reps.filter((r) => !r.deleted && r.color === rep.color), lib.moves).find((c) => c.epd === view.node.epd);
  }, [lib.version, view.node.epd, own]); // eslint-disable-line react-hooks/exhaustive-deps
  // Your imported games: what was played from each position and how you did after it, on both turns.
  const games = useGames((g) => g.games);
  useEffect(() => void useGames.getState().load(), []);
  const myIndex = useMemo(() => (rep ? myMovesByPosition(games, rep.color) : undefined), [games, rep?.color]); // eslint-disable-line react-hooks/exhaustive-deps
  const mineHere = myIndex?.get(view.node.epd);
  /** Positions your other repertoires of this colour already cover: candidates leading there "go with" them. */
  /** What your other lines in this folder (and the folders inside it) play here: lines alike are easier to remember. */
  const family = useMemo(() => {
    const out = new Set<string>();
    if (!rep?.folderId) return out;
    const ids = new Set(repsUnder(lib.folders, lib.reps, rep.folderId).filter((r) => r.id !== rep.id).map((r) => r.id));
    for (const m of lib.moves) if (!m.deleted && ids.has(m.repertoireId) && m.fromEpd === view.node.epd) out.add(m.uci);
    return out;
  }, [lib.version, rep?.id, rep?.folderId, view.node.epd]); // eslint-disable-line react-hooks/exhaustive-deps
  const otherEpds = useMemo(() => {
    const ids = new Set(lib.reps.filter((r) => !r.deleted && r.color === rep?.color && r.id !== rep?.id).map((r) => r.id));
    const out = new Set<string>();
    for (const m of lib.moves) if (!m.deleted && ids.has(m.repertoireId)) out.add(m.toEpd);
    return out;
  }, [lib.version, rep?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const candidates = useMemo(() => {
    if (!rep || !guided) return [];
    const pos = positionFromFen(view.node.fen);
    const fits = new Set<string>();
    // On their turn the same guide rates their options from their side: what they're likely to throw at you.
    if (own) for (const [from, tos] of view.dests) for (const to of tos) {
      try {
        if (otherEpds.has(playUci(pos, from + to).epd)) fits.add(from + to);
      } catch {
        /* promotions etc. need a piece suffix — not worth a badge */
      }
    }
    const engine = localNeeded && ev.lines.length ? mergeEngine(fromBundle, { lines: ev.lines, depth: ev.depth }) : fromBundle;
    // "Engine's pick" means the best move overall, so engine tags need a search of this position itself.
    const searched = !!guideData.bundle?.eval?.lines.length || (localNeeded && ev.lines.length > 0);
    return guideCandidates({ color: pos.turn, engineLines: engine.lines, engineDepth: searched ? engine.depth : 0, lichess: guideData.bundle?.lichess, masters: guideData.bundle?.masters, inRep: new Set(here.map((m) => m.uci)), family, fitsRep: fits, mine: mineHere, max: 8 });
  }, [rep, guided, own, view.node.fen, view.dests, ev.lines, ev.depth, localNeeded, fromBundle, guideData.bundle, here, family, otherEpds, mineHere]);

  // Fetch ahead along the arrow: the position after the top pick, then after the reply the guide will
  // play, so the next step shows at once.
  const topPick = own ? candidates[0]?.uci : undefined;
  useEffect(() => {
    if (!guided || !topPick || !rep) return;
    let live = true;
    const t = setTimeout(async () => {
      const fen = view.node.fen;
      let child: string;
      try {
        child = playUci(positionFromFen(fen), topPick).fen;
      } catch {
        return;
      }
      const prepared = view.node.children.find((c) => c.uci === topPick)?.children[0]?.uci;
      const reply = prepared ?? guideReply((await prefetchGuide(child, true)) ?? {});
      if (!live || !reply) return;
      try {
        await prefetchGuide(playUci(positionFromFen(child), reply).fen, true);
      } catch {
        /* illegal reply in stale data */
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [guided, topPick, view.node]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentMove = useMemo(() => {
    if (!view.path) return undefined;
    const parent = nodeAt(view.root, parentPath(view.path));
    return parent ? moves.find((m) => m.fromEpd === parent.epd && m.uci === view.node.uci) : undefined;
  }, [view.path, view.root, moves, view.node.uci]);

  const autoShapes = useMemo<DrawShape[]>(() => {
    const out: DrawShape[] = [];
    const arrow = (uci: string, brush: string, label?: string): DrawShape => ({ orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush, ...(label ? { label: { text: label } } : {}) });
    const pin = (c?: GuideCandidate) => (c?.tags[0] ? TAG_PIN[c.tags[0]] : undefined);
    if (guided && candidates.length) {
      // The top few suggestions, each pinned with its leading tag; the top pick is the bold one.
      candidates.slice(0, 3).forEach((c, i) => {
        if (c.uci !== hoverUci) out.push(arrow(c.uci, i === 0 ? (own ? 'green' : 'red') : own ? 'paleGreen' : 'paleRed', pin(c)));
      });
      if (hoverUci) out.push(arrow(hoverUci, 'blue', pin(candidates.find((c) => c.uci === hoverUci))));
    } else if (hoverUci) out.push(arrow(hoverUci, 'blue'));
    else if (engineOn && ev.lines[0]?.moves[0]) out.push(arrow(ev.lines[0].moves[0], 'paleBlue'));
    return out;
  }, [hoverUci, engineOn, ev.lines, guided, candidates, own]);

  if (!lib.loaded) return null;
  if (!rep)
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <PanelNote title={t('This repertoire doesn’t exist anymore')} action={<Button onClick={() => nav('/library')}>{t('Back to repertoire')}</Button>}>
          {t('It may have been deleted on another device.')}
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
    const mine = positionFromFen(fen).turn === rep.color;
    if (ready && !node.children.some((c) => c.uci === played.uci)) return;
    if (node.children.some((c) => c.uci === played.uci)) {
      st.goto(childPath(base, played.uci), { sound: true });
      return;
    }
    // Before the optimistic play below adds it: was there already a move here, so this one branches?
    const branching = node.children.length > 0;
    if (base !== st.path) st.goto(base);
    // Optimistic: the board advances immediately (with sound); IndexedDB catches up in the background
    // and the rebuild keeps this path because the node already exists.
    pendingPaths.current.add(childPath(base, played.uci));
    store.getState().play(played.uci);
    const m = await lib.addMove(rep.id, fen, played.uci);
    if (branching && !mine) {
      toast(t('{move} branches off this line', { move: m.san }), { action: { label: t('Make it a new line'), run: () => void splitOff(base, m.uci, m.san) } });
    }
    const mainHere = useLibrary.getState().moves.find((x) => x.repertoireId === rep.id && !x.deleted && x.fromEpd === m.fromEpd && x.isMainline && x.uci !== m.uci);
    if (!m.isMainline && mainHere) {
      toast(t('Added {move} as an alternate — you play {main} here', { move: m.san, main: mainHere.san }), { action: { label: t('Make main'), run: () => lib.makeMain(rep.id, m.fromEpd, m.uci) } });
    }
  };

  const deleteHere = async () => {
    if (!currentMove) return;
    const undo = await lib.deleteBranch(rep.id, currentMove.fromEpd, currentMove.uci);
    undoToast(t('Deleted {move} and everything after it', { move: currentMove.san }), undo);
  };
  const cutHere = async () => {
    const undo = await lib.cutAfter(rep.id, view.node.epd);
    undoToast(view.path ? t('The line now ends after {move}', { move: view.node.san }) : t('Line cleared'), undo);
  };
  /** Change a move: it and what follows go, and the board waits on the position before it for the new one. */
  const changeHere = async () => {
    if (!currentMove) return;
    const back = parentPath(view.path);
    const undo = await lib.deleteBranch(rep.id, currentMove.fromEpd, currentMove.uci);
    store.getState().goto(back);
    undoToast(t('Play the move that replaces {move}', { move: currentMove.san }), undo);
  };
  /** A new line next to this one with the moves so far; you carry on from here in it. */
  const branchHere = async () => {
    const name = opening?.name && opening.name !== rep.name ? opening.name : t('{name} (branch)', { name: rep.name });
    const nr = await lib.branchLine(rep.id, pathToUcis(view.path), { name });
    nav(`/rep/${nr.id}?at=${encodeURIComponent(view.node.epd)}`);
    toast(t('New line “{name}” — play its next move', { name: nr.name }), { kind: 'success' });
  };
  /** A move just played off the line becomes a line of its own, taking what follows it along. */
  async function splitOff(base: string, uci: string, san: string) {
    const nr = await lib.branchLine(rep!.id, pathToUcis(base), { name: `${rep!.name} · ${san}`, take: uci });
    const st = store.getState();
    const at = nodeAt(st.root, childPath(base, uci))?.epd;
    nav(`/rep/${nr.id}${at ? `?at=${encodeURIComponent(at)}` : ''}`);
  }

  const board = (
    <Board
      fen={view.node.fen}
      orientation={orientation}
      turnColor={view.turn}
      movable="both"
      dests={ready ? lineDests(view.node.children.map((c) => c.uci)) : view.dests}
      lastMove={view.lastMove}
      check={view.check}
      shapes={view.node.shapes as DrawShape[] | undefined}
      autoShapes={autoShapes}
      onShapesChange={(sh) => {
        if (currentMove && !ready) void lib.setShapes(rep.id, currentMove.fromEpd, currentMove.uci, sh);
      }}
      onMove={(u, f) => void addMove(u, f)}
      drawMode={drawMode}
      ariaLabel={`${t('Repertoire board.')} ${view.turn === 'white' ? t('White to move.') : t('Black to move.')}`}
    />
  );

  const status = (
    <div className="flex flex-wrap items-center gap-2">
      {own ? (
        main ? (
          <Chip tone="brand" icon={Crown}>
            {t('You play {move}', { move: main.san })}
            {here.length > 1 ? ` · ${tn(here.length - 1, '{n} alternate', '{n} alternates')}` : ''}
          </Chip>
        ) : (
          <Chip tone="warn" icon={Lightbulb}>
            {t('Your move — not decided yet')}
          </Chip>
        )
      ) : (
        <Chip tone="neutral" icon={Waypoints}>
          {here.length ? tn(here.length, '{n} reply prepared', '{n} replies prepared') : t('Their move — no replies yet')}
        </Chip>
      )}
      {conflict && (
        <Chip tone="warn">
          {t('Conflict')}: {[...conflict.choices.keys()].map((u) => uciToSan(positionFromFen(epdToFen(conflict.epd)), u)).join(' / ')}
        </Chip>
      )}
    </div>
  );

  const actions = ready ? (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-ink-2">{t('A ready-made line: play through it here, then practise it. Its moves are already decided.')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <PracticeButtons scope={{ kind: 'rep', id: rep.id }} size="sm" />
        <Button
          size="sm"
          variant="ghost"
          icon={Unlock}
          onClick={() => {
            void lib.takeOver(rep.id);
            toast(t('This line is yours now — add or change moves freely.'), { kind: 'success' });
          }}
        >
          {t('Edit this line')}
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap gap-2">
      {own && !guided && (
        <Button size="sm" icon={Sparkles} onClick={() => setPane('suggest')}>
          {t('Suggest my move')}
        </Button>
      )}
      <Button size="sm" icon={Waypoints} onClick={() => setAutoOpen(true)}>
        {t('Add popular replies')}
      </Button>
      {view.node.tags?.includes('alt') && currentMove && (
        <Button size="sm" icon={Star} onClick={() => void lib.makeMain(rep.id, currentMove.fromEpd, currentMove.uci)}>
          {t('Make main move')}
        </Button>
      )}
    </div>
  );

  const line = (
    <LinePanel
      root={view.root}
      path={view.path}
      rootUcis={rep.rootMovesUci}
      ready={ready}
      onGoto={(p) => store.getState().goto(p)}
      onCut={() => void cutHere()}
      onChange={() => void changeHere()}
      onDelete={() => void deleteHere()}
      onBranch={() => void branchHere()}
    />
  );

  const repUcis = new Set(here.map((m) => m.uci));
  const parentNode = view.path ? nodeAt(view.root, parentPath(view.path)) : undefined;
  const panes: Record<Pane, React.ReactNode> = {
    tree: <MoveTree store={store} emptyHint={own ? t('Play your first move on the board.') : t('Play the moves you expect from your opponent.')} />,
    explorer: <ExplorerPanel fen={view.node.fen} onPlay={(u) => void addMove(u)} onHoverMove={setHoverUci} highlightUcis={repUcis} />,
    engine: <EnginePanel fen={view.node.fen} view={ev} onPlayLine={(ucis) => ucis[0] && void addMove(ucis[0])} onHoverMove={setHoverUci} />,
    notes: <NotesPanel key={currentMove ? `${currentMove.fromEpd}${currentMove.uci}` : 'root'} move={currentMove} onSave={(note) => currentMove && lib.setNote(rep.id, currentMove.fromEpd, currentMove.uci, note)} />,
    stats: (
      <>
        <RepertoireStats rep={rep} />
        <MoveStatsPanel parentFen={parentNode?.fen} uci={view.node.uci || undefined} color={rep.color} />
      </>
    ),
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
    suggest: own ? <SuggestPanel fen={view.node.fen} color={rep.color} engineLines={ev.lines} onPick={(u) => void addMove(u)} onHover={setHoverUci} /> : <PanelNote title={t('Suggestions are for your moves')}>{t('Step to a position where it’s your turn.')}</PanelNote>,
  };
  const paneOptions = [
    { value: 'tree' as const, label: t('Moves') },
    { value: 'explorer' as const, label: t('Explorer') },
    { value: 'engine' as const, label: t('Engine') },
    { value: 'stats' as const, label: t('Stats') },
    { value: 'coach' as const, label: t('Coach') },
    ...(own && !ready ? [{ value: 'suggest' as const, label: t('Suggest') }] : []),
    { value: 'notes' as const, label: t('Notes') },
    { value: 'insights' as const, label: t('Coverage') },
  ];
  const activePane = pane === 'suggest' && (!own || ready) ? 'tree' : pane;

  const header = (
    <div className="flex min-h-[44px] items-center gap-2 px-4 lg:px-0">
      <Link to={backTo(lib.folders, rep.folderId)} className="-ms-2 flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3" aria-label={t('Back to repertoire')}>
        <ArrowLeft size={20} className="rtl:rotate-180" />
      </Link>
      <div className="min-w-0 flex-1">
        {renaming ? (
          <input
            autoFocus
            defaultValue={rep.name}
            aria-label={t('Rename')}
            className="w-full rounded-md border border-line-strong bg-surface px-2 py-0.5 text-md font-bold"
            onBlur={(e) => {
              void lib.renameRepertoire(rep.id, e.target.value);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setRenaming(false);
            }}
          />
        ) : (
          <button type="button" onClick={() => setRenaming(true)} className="group flex max-w-full items-center gap-1.5 text-start" aria-label={`${t('Rename')}: ${rep.name}`}>
            <h1 className="truncate text-md font-bold">{rep.name}</h1>
            <Pencil size={13} className="shrink-0 text-ink-3 opacity-60 group-hover:opacity-100" aria-hidden />
          </button>
        )}
        <p className="truncate text-xs text-ink-3">
          {folderPath(lib.folders, rep.folderId).map((n) => t(n)).join(' / ')}
          {opening ? ` · ${opening.eco} ${opening.name}` : ''}
        </p>
      </div>
      {ready ? (
        <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-brand-soft px-3 text-sm font-semibold text-brand-ink">
          <Sparkles size={16} aria-hidden />
          {t('Ready-made')}
        </span>
      ) : (
      <button
        type="button"
        aria-pressed={guided}
        onClick={() => usePrefs.getState().set({ guided: !guided })}
        className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors ${guided ? 'bg-brand text-on-brand' : 'bg-surface-3 text-ink-2 hover:text-ink'}`}
      >
        <Compass size={16} aria-hidden />
        {t('Guided')}
      </button>
      )}
    </div>
  );

  const guide = guided && (
    <div className="overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
      <GuidePanel
        fen={view.node.fen}
        own={own}
        candidates={candidates}
        explorer={explorer}
        searching={guideData.loading || (localNeeded && (ev.searching || ev.depth < GUIDE_MIN_DEPTH))}
        onPlay={(u) => {
          setHoverUci(null);
          void addMove(u);
        }}
        onHover={setHoverUci}
      />
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
          <BoardControls store={store} onTypedMove={(u) => void addMove(u)} />
        </div>
        <aside className="flex max-h-[calc(100dvh-2.5rem)] min-w-[360px] max-w-[480px] flex-1 flex-col gap-3">
          <div className="flex shrink-0 flex-col gap-3 rounded-[var(--radius-l)] border border-line bg-surface p-3.5 shadow-1">
            {line}
            <div className="border-t border-line pt-3">{status}</div>
            {actions}
          </div>
          {/* The guide scrolls on its own so the panels below always keep room. */}
          {guide && <div className="max-h-[45dvh] shrink-0 overflow-y-auto rounded-[var(--radius-l)]">{guide}</div>}
          <PaneTabs value={activePane} onChange={setPane} options={paneOptions} />
          <div className="min-h-[200px] flex-1 overflow-auto rounded-[var(--radius-l)] border border-line bg-surface shadow-1">{panes[activePane]}</div>
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
      <BoardControls store={store} drawMode={drawMode} onToggleDraw={() => setDrawMode((d) => !d)} onTypedMove={(u) => void addMove(u)} />
      <div className="px-3 pb-3">
        <div className="rounded-[var(--radius-l)] border border-line bg-surface p-3 shadow-1">{line}</div>
      </div>
      {guide && <div className="px-3 pb-3">{guide}</div>}
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

/** True once `on` has held for `ms`; false again as soon as it drops. */
function useHeldFor(on: boolean, ms: number) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!on) {
      setHeld(false);
      return;
    }
    const t = setTimeout(() => setHeld(true), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return held;
}

/** Back goes to the line's folder (its opening), not the top of the library. */
function backTo(folders: { id: string; parentId: string | null }[], folderId: string | null) {
  const f = folders.find((x) => x.id === folderId);
  return f && f.parentId !== null ? `/library?f=${f.id}` : '/library';
}

/** On a ready-made line the board only takes the line's own moves: playing through it, not adding to it. */
function lineDests(ucis: string[]): Map<Key, Key[]> {
  const out = new Map<Key, Key[]>();
  for (const u of ucis) {
    const from = u.slice(0, 2) as Key;
    out.set(from, [...(out.get(from) ?? []), u.slice(2, 4) as Key]);
  }
  return out;
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
    <div role="tablist" aria-label={t('Panel')} className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
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
