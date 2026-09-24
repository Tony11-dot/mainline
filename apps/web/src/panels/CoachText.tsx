import { Fragment, type ReactNode } from 'react';
import { positionFromFen, sanToUci } from '@mainline/shared';

/**
 * Renders the coach's short markdown safely (no HTML): paragraphs, bullet lists, **bold**, *italic*,
 * and [[SAN]] move chips. Chips are resolved against the position (or a later position in the line)
 * so hovering shows the arrow and clicking plays it.
 */
export function CoachText({ text, fen, onMove, onHover }: { text: string; fen: string; onMove?: (uci: string, san: string) => void; onHover?: (uci: string | null) => void }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2.5 text-[0.9375rem] leading-relaxed text-ink">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l)))
          return (
            <ul key={i} className="ml-4 list-disc space-y-1 marker:text-ink-3">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ''), fen, onMove, onHover)}</li>
              ))}
            </ul>
          );
        return <p key={i}>{inline(b.replace(/\n/g, ' '), fen, onMove, onHover)}</p>;
      })}
    </div>
  );
}

function inline(s: string, fen: string, onMove?: (uci: string, san: string) => void, onHover?: (uci: string | null) => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[\[([^\]]{1,12})\]\]|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(<Fragment key={k++}>{s.slice(last, m.index)}</Fragment>);
    if (m[1]) {
      const san = m[1].trim();
      let uci: string | undefined;
      try {
        uci = sanToUci(positionFromFen(fen), san.replace(/[!?]+$/, ''));
      } catch {
        uci = undefined;
      }
      out.push(
        <button
          key={k++}
          type="button"
          disabled={!uci || !onMove}
          onClick={() => uci && onMove?.(uci, san)}
          onMouseEnter={() => uci && onHover?.(uci)}
          onMouseLeave={() => onHover?.(null)}
          className="mx-0.5 inline-flex rounded-[6px] bg-brand-soft px-1.5 py-px align-baseline text-[0.9em] font-bold text-brand-ink enabled:hover:bg-brand enabled:hover:text-on-brand disabled:cursor-default"
        >
          {san}
        </button>,
      );
    } else if (m[2]) out.push(<strong key={k++}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={k++}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(<Fragment key="tail">{s.slice(last)}</Fragment>);
  return out;
}
