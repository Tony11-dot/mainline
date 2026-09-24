import { memo } from 'react';
import { buildGraph, isOwnTurn, lines, retrievability, type RepMove, type Repertoire, type TrainCard } from '@mainline/shared';

/**
 * Mastery heatmap: one cell per position you must know, in line order, coloured by how likely you are
 * to remember it right now (FSRS retrievability). Grey = not learned yet.
 */
export const MasteryStrip = memo(function MasteryStrip({ rep, moves, cards, now }: { rep: Repertoire; moves: RepMove[]; cards: TrainCard[]; now: number }) {
  const g = buildGraph(moves);
  const byEpd = new Map(cards.filter((c) => c.color === rep.color && !c.deleted).map((c) => [c.epd, c]));
  const order: string[] = [];
  const seen = new Set<string>();
  for (const l of lines(g, rep.rootEpd, { mainlineOnlyFor: rep.color })) {
    for (const m of l.moves) {
      if (isOwnTurn(rep.color, m.fromEpd) && !seen.has(m.fromEpd)) {
        seen.add(m.fromEpd);
        order.push(m.fromEpd);
      }
    }
  }
  if (!order.length) return null;
  const values = order.map((e) => (byEpd.has(e) ? retrievability(byEpd.get(e)!.fsrs, now) : -1));
  const learned = values.filter((v) => v >= 0);
  const mean = learned.length ? learned.reduce((a, b) => a + b, 0) / learned.length : 0;
  const cells = values.slice(0, 60);
  return (
    <span className="mt-1 flex items-center gap-2" aria-label={`Mastery ${Math.round(mean * 100)}%, ${learned.length} of ${order.length} learned`} role="img">
      <span className="flex flex-wrap gap-[2px]">
        {cells.map((v, i) => (
          <span
            key={i}
            className="size-[7px] rounded-[2px]"
            style={{ background: v < 0 ? 'var(--surface-3)' : `color-mix(in oklab, var(--good) ${Math.round(v * 100)}%, var(--bad))` }}
          />
        ))}
        {values.length > 60 && <span className="text-[10px] leading-[7px] text-ink-3">+{values.length - 60}</span>}
      </span>
      {learned.length > 0 && <span className="tnum text-xs font-semibold text-ink-2">{Math.round(mean * 100)}%</span>}
    </span>
  );
});
