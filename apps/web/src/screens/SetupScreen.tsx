import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Color, Key, Piece, Role } from 'chessground/types';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import '../board/board.css';
import { parseFen, makeFen } from 'chessops/fen';
import { Chess } from 'chessops/chess';
import { ChevronLeft, Copy, Cpu, Eraser, Hand, Repeat2, RotateCcw, Trash2 } from 'lucide-react';
import { INITIAL_FEN } from '@mainline/shared';
import { Button, IconButton, Segmented } from '../ui/primitives';
import { usePrefs } from '../lib/prefs';
import { platform } from '../platform';
import { msg, t } from '../lib/i18n';

const ROLES: Role[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
type Tool = 'move' | 'erase' | `${Color}-${Role}`;
type Castle = 'K' | 'Q' | 'k' | 'q';

const ERRORS: Record<string, string> = {
  ERR_EMPTY: msg('The board is empty.'),
  ERR_KINGS: msg('Each side needs exactly one king.'),
  ERR_PAWNS_ON_BACKRANK: msg('Pawns can’t stand on the first or last rank.'),
  ERR_OPPOSITE_CHECK: msg('The side not to move is in check — switch who’s to move.'),
  ERR_IMPOSSIBLE_CHECK: msg('That check can’t arise in a real game.'),
  ERR_VARIANT: msg('That position isn’t standard chess.'),
};

const PIECE_NAMES: Record<string, string> = {
  'white-king': msg('White king'),
  'white-queen': msg('White queen'),
  'white-rook': msg('White rook'),
  'white-bishop': msg('White bishop'),
  'white-knight': msg('White knight'),
  'white-pawn': msg('White pawn'),
  'black-king': msg('Black king'),
  'black-queen': msg('Black queen'),
  'black-rook': msg('Black rook'),
  'black-bishop': msg('Black bishop'),
  'black-knight': msg('Black knight'),
  'black-pawn': msg('Black pawn'),
};

/** The square under a point, from the board's live rect (chessground caches its bounds across scrolls). */
function squareAt(board: HTMLElement, x: number, y: number, orientation: Color): Key | undefined {
  const r = board.getBoundingClientRect();
  const col = Math.floor(((x - r.left) / r.width) * 8);
  const row = Math.floor(((y - r.top) / r.height) * 8);
  if (col < 0 || col > 7 || row < 0 || row > 7) return undefined;
  const file = orientation === 'white' ? col : 7 - col;
  const rank = orientation === 'white' ? 7 - row : row;
  return `${'abcdefgh'[file]}${rank + 1}` as Key;
}

function haptic() {
  if (usePrefs.getState().haptics) platform().haptic('selection');
}

/**
 * Board editor: place pieces from the palette (tap a piece, then tap squares — or drag it straight onto
 * the board), drag pieces around or off the board, set who's to move and castling, or paste a FEN.
 * "Analyse" opens the position on the analysis board with Stockfish running.
 */
export function SetupScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initial = useMemo(() => {
    const f = params.get('fen');
    return f && parseFen(f).isOk ? f : INITIAL_FEN;
  }, [params]);
  const [board, setBoard] = useState(initial.split(' ')[0]!);
  const [turn, setTurn] = useState<Color>(initial.split(' ')[1] === 'b' ? 'black' : 'white');
  const [castles, setCastles] = useState<Set<Castle>>(() => new Set((initial.split(' ')[2] ?? '').replace('-', '').split('') as Castle[]));
  const [orientation, setOrientation] = useState<Color>('white');
  const [tool, setTool] = useState<Tool>('move');
  const [fenDraft, setFenDraft] = useState<string | null>(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;

  const el = useRef<HTMLDivElement>(null);
  const cg = useRef<Api | null>(null);

  // The raw FEN as edited, then the position chessops accepts (castling rights it can't have dropped).
  const rawFen = `${board} ${turn[0]} ${[...castles].sort((a, b) => 'KQkq'.indexOf(a) - 'KQkq'.indexOf(b)).join('') || '-'} - 0 1`;
  const checked = useMemo(() => {
    const setup = parseFen(rawFen);
    if (setup.isErr) return { error: t('That FEN isn’t valid.') };
    const pos = Chess.fromSetup(setup.value);
    if (pos.isErr) return { error: ERRORS[pos.error.message] ? t(ERRORS[pos.error.message]!) : t('That position isn’t legal.') };
    return { fen: makeFen(pos.value.toSetup()) };
  }, [rawFen]);

  const error = 'error' in checked ? checked.error : undefined;
  const okFen = 'fen' in checked ? checked.fen : undefined;

  useLayoutEffect(() => {
    if (!el.current) return;
    const api = Chessground(el.current, {
      fen: board,
      orientation,
      coordinates: usePrefs.getState().coordinates,
      movable: { free: true, color: 'both', showDests: false },
      premovable: { enabled: false },
      draggable: { enabled: true, showGhost: true, deleteOnDropOff: true },
      selectable: { enabled: true },
      highlight: { lastMove: false, check: false },
      animation: { enabled: true, duration: 120 },
      drawable: { enabled: false },
      blockTouchScroll: true,
      disableContextMenu: true,
      events: {
        change: () => setBoard(api.getFen()),
      },
    });
    cg.current = api;
    const ro = new ResizeObserver(() => api.redrawAll());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      api.destroy();
      cg.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const api = cg.current;
    if (api && api.getFen() !== board) api.set({ fen: board });
  }, [board]);
  useEffect(() => cg.current?.set({ orientation }), [orientation]);

  // Placing/erasing tools: a tap on a square puts the chosen piece there (tap again to remove it).
  const onBoardPointerDown = (e: React.PointerEvent) => {
    const t = toolRef.current;
    const api = cg.current;
    if (t === 'move' || !api) return;
    const key = squareAt(e.currentTarget as HTMLElement, e.clientX, e.clientY, api.state.orientation);
    if (!key) return;
    e.preventDefault();
    e.stopPropagation();
    const current = api.state.pieces.get(key);
    let next: Piece | undefined;
    if (t !== 'erase') {
      const [color, role] = t.split('-') as [Color, Role];
      next = current?.color === color && current.role === role ? undefined : { color, role };
    }
    api.setPieces(new Map([[key as Key, next]]));
    haptic();
    setBoard(api.getFen());
  };

  const pick = (t: Tool) => {
    setTool((cur) => (cur === t && t !== 'move' ? 'move' : t));
    haptic();
  };

  // Dragging from the palette drops a new piece wherever the finger lifts. The drag only starts once
  // the pointer actually moves, so a plain tap just picks the placing tool.
  const pending = useRef<{ piece: Piece; x: number; y: number } | null>(null);
  const paletteDown = (piece: Piece, e: React.PointerEvent) => {
    pending.current = { piece, x: e.clientX, y: e.clientY };
  };
  const paletteMove = (e: React.PointerEvent) => {
    const p = pending.current;
    if (!p || !cg.current || Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
    pending.current = null;
    cg.current.dragNewPiece(p.piece, e.nativeEvent as unknown as MouseEvent, true);
  };

  const applyFen = (text: string) => {
    const f = text.trim();
    const setup = parseFen(f);
    if (setup.isErr) return false;
    const parts = f.split(/\s+/);
    setBoard(parts[0]!);
    setTurn(parts[1] === 'b' ? 'black' : 'white');
    setCastles(new Set((parts[2] ?? '').replace('-', '').split('').filter((c) => 'KQkq'.includes(c)) as Castle[]));
    return true;
  };

  const analyse = () => {
    if (!okFen) return;
    usePrefs.getState().set({ engineOn: true });
    void navigate(`/explore?${new URLSearchParams({ fen: okFen, color: orientation, engine: '1' })}`);
  };

  const palette = (color: Color) => (
    <div className="cg-wrap setup-palette" role="toolbar" aria-label={color === 'white' ? t('White pieces') : t('Black pieces')}>
      {ROLES.map((role) => {
        const id = `${color}-${role}` as Tool;
        const on = tool === id;
        return (
          <button
            key={role}
            type="button"
            aria-label={t('Place {piece}', { piece: t(PIECE_NAMES[`${color}-${role}`]!) })}
            aria-pressed={on}
            className={`setup-piece grid aspect-square w-[min(13vw,52px)] touch-none place-items-center rounded-[var(--radius-control)] transition-[background-color,transform] duration-150 ${on ? 'scale-105 bg-brand-soft ring-2 ring-brand' : 'hover:bg-surface-3'}`}
            onClick={() => pick(id)}
            onPointerDown={(e) => paletteDown({ color, role }, e)}
            onPointerMove={paletteMove}
            onPointerUp={() => (pending.current = null)}
            onPointerCancel={() => (pending.current = null)}
          >
            {createElement('piece', { className: `${role} ${color}` })}
          </button>
        );
      })}
    </div>
  );

  const castleChip = (c: Castle, label: string) => (
    <label key={c} className={`pressable flex min-h-10 py-1 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${castles.has(c) ? 'bg-brand text-on-brand' : 'bg-surface-3 text-ink-2 hover:text-ink'}`}>
      <input
        type="checkbox"
        className="sr-only"
        checked={castles.has(c)}
        onChange={(e) =>
          setCastles((s) => {
            const n = new Set(s);
            if (e.target.checked) n.add(c);
            else n.delete(c);
            return n;
          })
        }
      />
      {label}
    </label>
  );


  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4 pb-6 lg:flex-row lg:items-start lg:px-6 lg:py-5">
      <div className="flex min-w-0 flex-col lg:w-[min(calc(100dvh-10rem),60%)]">
        <div className="flex min-h-[52px] flex-wrap items-center gap-1 px-2 py-1 lg:px-0">
          <Link to="/explore" className="pressable flex min-h-11 py-1 items-center gap-1 rounded-full px-2.5 text-base font-semibold text-brand-ink hover:bg-brand-softer">
            <ChevronLeft size={20} className="rtl:rotate-180" aria-hidden /> {t('Explore')}
          </Link>
          <h1 className="ms-1 line-clamp-2 min-w-[min(10rem,100%)] flex-1 text-lg leading-tight font-bold break-words">{t('Set up position')}</h1>
        </div>
        {palette(orientation === 'white' ? 'black' : 'white')}
        {/* Board + palettes + controls fit the viewport height: the palettes are px (they do not grow with text), the header and controls rem. The board never drops under 260 px, so at 2× text the page scrolls instead. */}
        <div className="mx-auto w-full" style={{ maxWidth: 'max(260px, calc(100dvh - 120px - 11.5rem))' }}>
          <div className={`ml-board relative aspect-square w-full select-none ${tool !== 'move' ? 'cursor-crosshair' : ''}`} onPointerDownCapture={onBoardPointerDown} role="application" aria-label={t('Board editor')}>
            <div ref={el} className="h-full w-full" />
          </div>
        </div>
        {palette(orientation)}
        <div className="flex items-center justify-center gap-1 px-2">
          <Button size="sm" variant={tool === 'move' ? 'primary' : 'ghost'} icon={Hand} onClick={() => pick('move')} aria-pressed={tool === 'move'}>
            {t('Move')}
          </Button>
          <Button size="sm" variant={tool === 'erase' ? 'primary' : 'ghost'} icon={Eraser} onClick={() => pick('erase')} aria-pressed={tool === 'erase'}>
            {t('Erase')}
          </Button>
          <IconButton icon={Repeat2} label={t('Flip board')} onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} />
        </div>
      </div>

      <aside className="flex flex-col gap-5 px-4 lg:min-w-[320px] lg:flex-1 lg:px-0 lg:pt-12">
        <div className="flex flex-col gap-2.5">
          <h2 className="text-md font-bold">{t('To move')}</h2>
          <Segmented label={t('Side to move')} value={turn} onChange={setTurn} options={[{ value: 'white', label: t('White') }, { value: 'black', label: t('Black') }]} />
        </div>
        <div className="flex flex-col gap-2.5">
          <h2 className="text-md font-bold">{t('Castling')}</h2>
          <div className="flex flex-wrap gap-2">
            {castleChip('K', t('White O-O'))}
            {castleChip('Q', t('White O-O-O'))}
            {castleChip('k', t('Black O-O'))}
            {castleChip('q', t('Black O-O-O'))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => applyFen(INITIAL_FEN)}>
            {t('Starting position')}
          </Button>
          <Button size="sm" variant="secondary" icon={Trash2} onClick={() => applyFen('8/8/8/8/8/8/8/8 w - - 0 1')}>
            {t('Clear board')}
          </Button>
        </div>
        <div className="flex flex-col gap-2.5">
          <label htmlFor="setup-fen" className="text-md font-bold">
            FEN
          </label>
          <div className="flex gap-2">
            <input
              id="setup-fen"
              className="tnum h-12 min-w-0 flex-1 rounded-[var(--radius-control)] border border-line bg-surface px-3.5 font-mono text-sm outline-none focus:border-brand focus:ring-3 focus:ring-brand/20"
              value={fenDraft ?? rawFen}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              onChange={(e) => {
                setFenDraft(e.target.value);
                if (applyFen(e.target.value)) setFenDraft(null);
              }}
              onBlur={() => setFenDraft(null)}
            />
            <IconButton icon={Copy} label={t('Copy FEN')} onClick={() => void navigator.clipboard?.writeText(okFen ?? rawFen).catch(() => undefined)} />
          </div>
          {fenDraft !== null && <p className="text-sm text-ink-2">{t('Paste or type a full FEN — it applies as soon as it’s valid.')}</p>}
        </div>
        <p role="status" className={`min-h-5 text-base ${error ? 'font-medium text-bad-ink' : 'text-ink-2'}`}>
          {error ?? t('Legal position — ready to analyse.')}
        </p>
        <Button size="lg" variant="primary" icon={Cpu} onClick={analyse} disabled={!!error}>
          {t('Analyse with engine')}
        </Button>
      </aside>
    </div>
  );
}
