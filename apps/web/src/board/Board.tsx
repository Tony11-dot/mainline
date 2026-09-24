import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import './board.css';
import { legalDests, playUci, positionFromFen } from '@mainline/shared';
import { usePrefs } from '../lib/prefs';
import { platform } from '../platform';
import { PromotionPicker, type PromotionRole } from './PromotionPicker';

export type { DrawShape, Key };
export type BoardColor = 'white' | 'black';

export interface BoardProps {
  fen: string;
  orientation: BoardColor;
  turnColor: BoardColor;
  /** Which side the user may move. undefined = view only. */
  movable?: BoardColor | 'both';
  dests?: Map<Key, Key[]>;
  lastMove?: [Key, Key];
  check?: boolean;
  shapes?: DrawShape[];
  autoShapes?: DrawShape[];
  onShapesChange?: (shapes: DrawShape[]) => void;
  /** Called with a full UCI move (promotion piece included) and the FEN the board showed when it was made. */
  onMove?: (uci: string, fromFen: string) => void;
  /** Draw mode for touch: taps/drags draw shapes instead of moving. */
  drawMode?: boolean;
  /** Visual feedback, e.g. a shake on a wrong move. */
  flash?: { kind: 'wrong' | 'right'; key: number };
  className?: string;
  ariaLabel?: string;
  /** Change to force the board back to `fen` (e.g. to take back a wrong move in training). */
  syncKey?: number;
}

const LONG_PRESS_MS = 380;

export function Board(props: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const cg = useRef<Api | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [promotion, setPromotion] = useState<{ from: Key; to: Key; color: BoardColor } | null>(null);
  const prefs = usePrefs();

  // Create once.
  useLayoutEffect(() => {
    if (!el.current) return;
    cg.current = Chessground(el.current, {
      ...configFor(propsRef.current, prefs),
      blockTouchScroll: true,
      disableContextMenu: true,
      addDimensionsCssVarsTo: wrap.current ?? undefined,
      premovable: { enabled: false },
      draggable: { enabled: true, showGhost: true, distance: 3, autoDistance: true },
      selectable: { enabled: true },
      highlight: { lastMove: true, check: true },
      drawable: {
        enabled: true,
        visible: true,
        eraseOnClick: true,
        defaultSnapToValidMove: true,
        onChange: (shapes) => propsRef.current.onShapesChange?.(shapes),
      },
      events: {
        select: () => hapticIf('selection'),
      },
    });
    // chessground measures itself only on window resize; layout changes (panels, rotation) need this.
    const ro = new ResizeObserver(() => cg.current?.redrawAll());
    if (wrap.current) ro.observe(wrap.current);
    return () => {
      ro.disconnect();
      cg.current?.destroy();
      cg.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync props → chessground. Only reconfigure when the position/interaction actually changed:
  // calling set() cancels an in-progress drag, and parents re-render often (new Map for dests, etc.).
  const applied = useRef<string>('');
  /** The position chessground is actually displaying (moves are made on this, not on later props). */
  const shownFen = useRef(props.fen);
  useLayoutEffect(() => {
    const api = cg.current;
    if (!api) return;
    const key = configKey(props, prefs);
    if (key !== applied.current) {
      applied.current = key;
      shownFen.current = props.fen;
      api.set(configFor(props, prefs, (from, to) => onUserMove(from, to)));
    } else {
      api.setShapes(props.shapes ?? []);
      api.setAutoShapes(props.autoShapes ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fen, props.orientation, props.turnColor, props.movable, props.dests, props.lastMove, props.check, props.shapes, props.autoShapes, props.drawMode, props.syncKey, prefs.showDests, prefs.coordinates, prefs.animationMs]);

  function onUserMove(from: Key, to: Key) {
    const api = cg.current!;
    const piece = api.state.pieces.get(to);
    if (piece?.role === 'pawn' && (to[1] === '8' || to[1] === '1')) {
      setPromotion({ from, to, color: piece.color });
      return;
    }
    hapticIf('light');
    const fromFen = shownFen.current;
    advanceLocally(from, to);
    propsRef.current.onMove?.(from + to, fromFen);
  }

  /**
   * In free-play boards, immediately give chessground the next position's legal moves so a quick
   * follow-up move isn't dropped while React re-renders (slow phones). The parent's matching update
   * is then recognised as already applied and doesn't interrupt a drag in progress.
   */
  function advanceLocally(from: Key, to: Key, promo = '') {
    const p = propsRef.current;
    if (p.movable !== 'both' || !cg.current) return;
    try {
      const played = playUci(positionFromFen(shownFen.current), from + to + promo);
      const turn = played.pos.turn;
      shownFen.current = played.fen;
      cg.current.set({ fen: played.fen, lastMove: [played.uci.slice(0, 2), played.uci.slice(2, 4)] as Key[], turnColor: turn, check: played.check ? turn : false, movable: { color: 'both', dests: legalDests(played.pos) as Map<Key, Key[]> } });
      applied.current = configKey({ ...p, fen: played.fen, turnColor: turn, check: played.check, lastMove: [played.uci.slice(0, 2), played.uci.slice(2, 4)] as [Key, Key] }, prefs);
    } catch {
      /* illegal per chessops: let the parent decide */
    }
  }

  function onPromote(role: PromotionRole | null) {
    const p = promotion;
    setPromotion(null);
    if (!p) return;
    if (!role) {
      // Cancelled: put the pawn back.
      cg.current?.set({ fen: propsRef.current.fen, lastMove: propsRef.current.lastMove });
      return;
    }
    hapticIf('light');
    const promo = ({ queen: 'q', rook: 'r', bishop: 'b', knight: 'n' } as const)[role];
    const fromFen = shownFen.current;
    advanceLocally(p.from, p.to, promo);
    propsRef.current.onMove?.(p.from + p.to + promo, fromFen);
  }

  // Wrong/right move feedback.
  useEffect(() => {
    if (!props.flash || !wrap.current) return;
    const node = wrap.current;
    const cls = props.flash.kind === 'wrong' ? 'board-shake' : 'board-glow';
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
    const t = setTimeout(() => node.classList.remove(cls), 500);
    return () => clearTimeout(t);
  }, [props.flash]);

  useTouchDrawing(wrap, cg, propsRef);

  return (
    <div
      ref={wrap}
      className={`ml-board relative aspect-square w-full select-none ${props.className ?? ''} ${props.drawMode ? 'draw-mode' : ''}`}
      role="application"
      aria-label={props.ariaLabel ?? 'Chess board'}
    >
      <div ref={el} className="h-full w-full" />
      {promotion && (
        <PromotionPicker
          color={promotion.color}
          file={promotion.to.charCodeAt(0) - 97}
          orientation={props.orientation}
          onPick={onPromote}
        />
      )}
    </div>
  );
}

function configKey(p: Pick<BoardProps, 'fen' | 'orientation' | 'turnColor' | 'movable' | 'lastMove' | 'check' | 'drawMode' | 'syncKey'>, prefs: { showDests: boolean; coordinates: boolean; animationMs: number }) {
  return [p.syncKey ?? 0, p.fen, p.orientation, p.turnColor, p.movable ?? '', p.lastMove?.join('') ?? '', p.check ? 1 : 0, p.drawMode ? 1 : 0, prefs.showDests ? 1 : 0, prefs.coordinates ? 1 : 0, prefs.animationMs].join('|');
}

function hapticIf(kind: Parameters<ReturnType<typeof platform>['haptic']>[0]) {
  if (usePrefs.getState().haptics) platform().haptic(kind);
}

function configFor(p: BoardProps, prefs: { showDests: boolean; coordinates: boolean; animationMs: number }, after?: (from: Key, to: Key) => void): Config {
  const canMove = !!p.movable && !p.drawMode;
  return {
    fen: p.fen,
    orientation: p.orientation,
    turnColor: p.turnColor,
    lastMove: p.lastMove,
    check: p.check ? p.turnColor : false,
    coordinates: prefs.coordinates,
    viewOnly: false,
    animation: { enabled: prefs.animationMs > 0, duration: prefs.animationMs },
    movable: {
      free: false,
      color: canMove ? p.movable : undefined,
      dests: canMove ? p.dests : new Map(),
      showDests: prefs.showDests,
      rookCastle: true,
      ...(after ? { events: { after: (orig: Key, dest: Key) => after(orig, dest) } } : {}),
    },
    drawable: {
      shapes: p.shapes ?? [],
      autoShapes: p.autoShapes ?? [],
    },
  };
}

/**
 * Touch drawing. chessground only draws with the right mouse button, so on touch we add:
 * - long-press on a square, then drag → arrow (or release in place → circle)
 * - "draw mode" (pen button): every tap/drag draws.
 */
function useTouchDrawing(
  wrap: React.RefObject<HTMLDivElement | null>,
  cg: React.RefObject<Api | null>,
  propsRef: React.RefObject<BoardProps>,
) {
  useEffect(() => {
    const node = wrap.current;
    if (!node) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let drawing: { orig: Key; pointerId: number } | null = null;
    let startXY: [number, number] | null = null;

    const keyAt = (x: number, y: number) => cg.current?.getKeyAtDomPos([x, y]);

    const beginDraw = (orig: Key, pointerId: number) => {
      drawing = { orig, pointerId };
      cg.current?.cancelMove();
      cg.current?.selectSquare(null);
      node.classList.add('drawing');
      hapticIf('medium');
      cg.current?.setAutoShapes([...(propsRef.current.autoShapes ?? []), { orig, brush: 'paleGreen' }]);
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const orig = keyAt(e.clientX, e.clientY);
      if (!orig) return;
      startXY = [e.clientX, e.clientY];
      if (propsRef.current.drawMode) {
        e.preventDefault();
        e.stopPropagation();
        beginDraw(orig, e.pointerId);
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => beginDraw(orig, e.pointerId), LONG_PRESS_MS);
    };

    const onMove = (e: PointerEvent) => {
      if (!drawing && startXY && timer) {
        const dx = e.clientX - startXY[0];
        const dy = e.clientY - startXY[1];
        // Finger moved → it's a drag, not a long-press.
        if (dx * dx + dy * dy > 64) {
          clearTimeout(timer);
          timer = undefined;
        }
      }
      if (drawing && e.pointerId === drawing.pointerId) {
        e.preventDefault();
        e.stopPropagation();
        const dest = keyAt(e.clientX, e.clientY);
        const preview: DrawShape = dest && dest !== drawing.orig ? { orig: drawing.orig, dest, brush: 'paleGreen' } : { orig: drawing.orig, brush: 'paleGreen' };
        cg.current?.setAutoShapes([...(propsRef.current.autoShapes ?? []), preview]);
      }
    };

    const onUp = (e: PointerEvent) => {
      clearTimeout(timer);
      timer = undefined;
      startXY = null;
      if (!drawing || e.pointerId !== drawing.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      const dest = keyAt(e.clientX, e.clientY);
      const shape: DrawShape = dest && dest !== drawing.orig ? { orig: drawing.orig, dest, brush: 'green' } : { orig: drawing.orig, brush: 'green' };
      const current = cg.current?.state.drawable.shapes ?? [];
      const same = (s: DrawShape) => s.orig === shape.orig && s.dest === shape.dest;
      const next = current.some(same) ? current.filter((s) => !same(s)) : [...current, shape];
      cg.current?.setShapes(next);
      cg.current?.setAutoShapes(propsRef.current.autoShapes ?? []);
      propsRef.current.onShapesChange?.(next);
      node.classList.remove('drawing');
      drawing = null;
    };

    const onCancel = () => {
      clearTimeout(timer);
      if (drawing) cg.current?.setAutoShapes(propsRef.current.autoShapes ?? []);
      drawing = null;
      node.classList.remove('drawing');
    };

    node.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointermove', onMove, { capture: true, passive: false });
    window.addEventListener('pointerup', onUp, { capture: true });
    window.addEventListener('pointercancel', onCancel, { capture: true });
    return () => {
      node.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointermove', onMove, { capture: true });
      window.removeEventListener('pointerup', onUp, { capture: true });
      window.removeEventListener('pointercancel', onCancel, { capture: true });
      clearTimeout(timer);
    };
  }, [wrap, cg, propsRef]);
}
