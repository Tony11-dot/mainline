import type { EvalLine } from './api';

/** Lichess' win-probability curve: maps centipawns to winning chances in [-1, 1] (White POV). */
export function winningChances(line: Pick<EvalLine, 'cp' | 'mate'>): number {
  if (line.mate !== undefined && line.mate !== null) return line.mate > 0 ? 1 : -1;
  const cp = Math.max(-1000, Math.min(1000, line.cp ?? 0));
  return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
}

/** Eval in pawns (White POV), mates mapped to ±100. */
export function evalPawns(line: Pick<EvalLine, 'cp' | 'mate'>): number {
  if (line.mate !== undefined && line.mate !== null) return line.mate > 0 ? 100 : -100;
  return (line.cp ?? 0) / 100;
}

/** "+0.34", "−1.20", "#3", "#−2" */
export function formatEval(line: Pick<EvalLine, 'cp' | 'mate'> | undefined): string {
  if (!line) return '…';
  if (line.mate !== undefined && line.mate !== null) return line.mate > 0 ? `#${line.mate}` : `#−${-line.mate}`;
  const p = (line.cp ?? 0) / 100;
  if (Math.abs(p) < 0.005) return '0.00';
  return `${p > 0 ? '+' : '−'}${Math.abs(p).toFixed(2)}`;
}

/**
 * Eval swing of a move for the side that played it, in pawns: positive = the move lost ground.
 * `before` and `after` are White-POV evals of the positions before/after the move.
 */
export function evalSwing(before: number, after: number, mover: 'white' | 'black'): number {
  const b = Math.max(-10, Math.min(10, before));
  const a = Math.max(-10, Math.min(10, after));
  return mover === 'white' ? b - a : a - b;
}

/** W/D/L percentages that sum to 100 (largest-remainder rounding). */
export function wdlPercents(white: number, draws: number, black: number): [number, number, number] {
  const total = white + draws + black;
  if (!total) return [0, 0, 0];
  const raw = [white, draws, black].map((x) => (x / total) * 100);
  const floor = raw.map(Math.floor);
  let rest = 100 - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    floor[i]!++;
    rest--;
  }
  return floor as [number, number, number];
}
