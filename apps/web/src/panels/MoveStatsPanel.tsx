import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { evalSwing, evalPawns, formatEval, playUci, positionFromFen, toEpd, wdlPercents, type Color, type EvalData, type ExplorerData } from '@mainline/shared';
import { fetchExplorer } from '../lib/explorer';
import { fetchCloudEval } from '../lib/evals';
import { usePrefs } from '../lib/prefs';
import { useTraining } from '../lib/training';
import { PanelNote, Skeleton } from '../ui/primitives';
import { WdlBar } from './ExplorerPanel';

/** Everything known about one repertoire move — every number from an engine or a game database. */
export function MoveStatsPanel({ parentFen, uci, color }: { parentFen?: string; uci?: string; color: Color }) {
  const { rating, speeds } = usePrefs();
  const reviews = useTraining((t) => t.reviews);
  const [d, setD] = useState<{ before?: EvalData | null; after?: EvalData | null; lichess?: ExplorerData; masters?: ExplorerData; loading: boolean }>({ loading: true });

  useEffect(() => {
    if (!parentFen || !uci) return;
    const ctrl = new AbortController();
    setD({ loading: true });
    const childFen = playUci(positionFromFen(parentFen), uci).fen;
    void Promise.allSettled([
      fetchCloudEval(parentFen, ctrl.signal),
      fetchCloudEval(childFen, ctrl.signal),
      fetchExplorer('lichess', parentFen, rating, speeds, ctrl.signal),
      fetchExplorer('masters', parentFen, rating, speeds, ctrl.signal),
    ]).then(([b, a, l, m]) => {
      if (ctrl.signal.aborted) return;
      const v = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : undefined);
      setD({ before: v(b), after: v(a), lichess: v(l), masters: v(m), loading: false });
    });
    return () => ctrl.abort();
  }, [parentFen, uci, rating, speeds]);

  if (!parentFen || !uci) return <PanelNote title="Select a move">Step into the line to see stats for that move.</PanelNote>;
  if (d.loading)
    return (
      <div className="flex flex-col gap-2 p-3.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );

  const pos = positionFromFen(parentFen);
  const mover = pos.turn;
  const best = d.before?.lines[0];
  const after = d.after?.lines[0];
  const swing = best && after ? evalSwing(evalPawns(best), evalPawns(after), mover) : undefined;
  const lm = d.lichess?.moves.find((m) => m.uci === uci);
  const mm = d.masters?.moves.find((m) => m.uci === uci);
  const players = (d.masters?.topGames ?? []).filter((g) => g.uci === uci).slice(0, 5);
  const epd = toEpd(parentFen);
  const mine = mover === color ? reviews.filter((r) => r.cardEpd === epd && r.color === color && r.mode !== 'drill') : [];
  const correct = mine.filter((r) => r.rating > 1).length;
  const score = (m?: { white: number; draws: number; black: number; total: number }) => (m && m.total ? Math.round(((color === 'white' ? m.white : m.black) + m.draws / 2) / m.total * 100) : undefined);

  return (
    <dl className="flex flex-col divide-y divide-line text-sm">
      <Row label="Engine">
        {after ? (
          <span className="tnum font-semibold">
            {formatEval(after)} after this move
            {best && <span className="font-normal text-ink-2"> · best {formatEval(best)}</span>}
            <span className="font-normal text-ink-3"> · depth {d.after!.depth}</span>
          </span>
        ) : (
          <span className="text-ink-3">No cloud evaluation for this position yet</span>
        )}
      </Row>
      {swing !== undefined && (
        <Row label="Eval swing">
          <span className={`tnum inline-flex items-center gap-1.5 font-semibold ${swing >= 0.7 ? 'text-warn' : ''}`}>
            {swing >= 0.7 && <TriangleAlert size={14} aria-hidden />}
            {swing <= 0.05 ? 'None — this is the engine’s choice' : `−${swing.toFixed(2)} for ${mover} vs the engine’s best`}
          </span>
        </Row>
      )}
      <Row label={`At ${rating} (${speeds.join('/')})`}>
        {lm && d.lichess ? (
          <div className="flex flex-col gap-1.5">
            <span className="tnum">
              <b>{Math.round((lm.total / d.lichess.total) * 100)}%</b> of {d.lichess.total.toLocaleString()} games · you score <b>{score(lm)}%</b>
            </span>
            <WdlBar white={lm.white} draws={lm.draws} black={lm.black} />
          </div>
        ) : (
          <span className="text-ink-3">{d.lichess ? 'Not played at this level' : 'Explorer unavailable'}</span>
        )}
      </Row>
      <Row label="Masters">
        {mm && d.masters ? (
          <div className="flex flex-col gap-1.5">
            <span className="tnum">
              <b>{Math.round((mm.total / d.masters.total) * 100)}%</b> · {mm.total.toLocaleString()} games · you score <b>{score(mm)}%</b>
            </span>
            <WdlBar white={mm.white} draws={mm.draws} black={mm.black} />
            {players.length > 0 && (
              <span className="text-ink-2">
                Played by {players.map((g) => `${(mover === 'white' ? g.white : g.black).name.split(',')[0]} (${g.year ?? '?'})`).join(', ')}
              </span>
            )}
          </div>
        ) : (
          <span className="text-ink-3">{d.masters ? 'No master games' : 'Explorer unavailable'}</span>
        )}
      </Row>
      {mover === color && (
        <Row label="Your training">
          <span className="tnum">{mine.length ? `${correct} of ${mine.length} correct (${Math.round((correct / mine.length) * 100)}%)` : 'Not trained yet'}</span>
        </Row>
      )}
      {lm && (
        <Row label="Result split">
          <span className="tnum text-ink-2">
            {(() => {
              const [w, dr, b] = wdlPercents(lm.white, lm.draws, lm.black);
              return `White ${w}% · draws ${dr}% · Black ${b}%`;
            })()}
          </span>
        </Row>
      )}
    </dl>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 px-3.5 py-3">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
