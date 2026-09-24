import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { positionFromFen, rankMoves, uciToSan, type Color, type EvalLine, type MoveSuggestion } from '@mainline/shared';
import { fetchExplorer } from '../../lib/explorer';
import { usePrefs } from '../../lib/prefs';
import { Button, PanelNote, Skeleton } from '../../ui/primitives';

/** Ranks candidate moves by engine eval, practical score at your rating, and master usage. */
export function SuggestPanel({ fen, color, engineLines, onPick, onHover }: { fen: string; color: Color; engineLines: EvalLine[]; onPick: (uci: string) => void; onHover: (uci: string | null) => void }) {
  const { rating, speeds } = usePrefs();
  const [ex, setEx] = useState<{ lichess?: Awaited<ReturnType<typeof fetchExplorer>>; masters?: Awaited<ReturnType<typeof fetchExplorer>>; loading: boolean }>({ loading: true });
  useEffect(() => {
    const ctrl = new AbortController();
    setEx({ loading: true });
    void Promise.allSettled([fetchExplorer('lichess', fen, rating, speeds, ctrl.signal), fetchExplorer('masters', fen, rating, speeds, ctrl.signal)]).then(([l, m]) => {
      if (ctrl.signal.aborted) return;
      setEx({ lichess: l.status === 'fulfilled' ? l.value : undefined, masters: m.status === 'fulfilled' ? m.value : undefined, loading: false });
    });
    return () => ctrl.abort();
  }, [fen, rating, speeds]);

  const ranked = rankMoves({ color, engineLines, lichess: ex.lichess, masters: ex.masters }).slice(0, 5);
  const pos = positionFromFen(fen);
  if (ex.loading && !engineLines.length) return <div className="flex flex-col gap-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>;
  if (!ranked.length) return <PanelNote title="Not enough data yet">Turn the engine on or sign in with Lichess for explorer stats.</PanelNote>;
  return (
    <ol className="flex flex-col divide-y divide-line">
      {ranked.map((s, i) => (
        <li key={s.uci} className="flex items-center gap-3 px-3 py-2.5" onMouseEnter={() => onHover(s.uci)} onMouseLeave={() => onHover(null)}>
          <span className="tnum w-5 text-center text-sm font-bold text-ink-3">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="font-bold">{s.san ?? uciToSan(pos, s.uci)}</div>
            <Signals s={s} />
          </div>
          <Button size="sm" icon={Plus} onClick={() => onPick(s.uci)} aria-label={`Add ${s.san ?? s.uci}`}>
            Add
          </Button>
        </li>
      ))}
      <li className="px-3 py-2.5 text-xs text-ink-3">Engine 45% · your-rating results 35% · master popularity 20%. Every number comes from Stockfish or real games.</li>
    </ol>
  );
}

function Signals({ s }: { s: MoveSuggestion }) {
  const pct = (x?: number) => (x === undefined ? '—' : `${Math.round(x * 100)}%`);
  return (
    <div className="tnum mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-2">
      <span title="Expected score from the engine">Engine {pct(s.engine)}</span>
      <span title="Your side's score at your rating">Club {pct(s.practical)}{s.practicalGames ? ` · ${s.practicalGames.toLocaleString()} games` : ''}</span>
      <span title="Share of master games">Masters {pct(s.masterShare)}</span>
    </div>
  );
}
