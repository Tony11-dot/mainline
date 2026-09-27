import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import type { Repertoire } from '@mainline/shared';
import { useLibrary } from '../lib/library';
import { useTraining } from '../lib/training';
import { analyse, useGames } from '../lib/games';
import { pct, repertoireGames, repertoireShape, trainingStats } from '../lib/stats';
import { MaturityBar, RecordBar } from '../ui/stats';

/** The whole repertoire at a glance: its size, how well you know it, and how it does in your games. */
export function RepertoireStats({ rep }: { rep: Repertoire }) {
  const moves = useLibrary((s) => s.moves);
  const libVersion = useLibrary((s) => s.version);
  const { reviews, cards } = useTraining();
  const games = useGames((s) => s.games);
  const loadGames = useGames((s) => s.load);
  useEffect(() => void loadGames(), [loadGames]);

  const shape = useMemo(() => repertoireShape(rep, moves), [rep, moves]);
  const tr = useMemo(() => trainingStats(reviews, cards, { positions: shape.positions }), [reviews, cards, shape.positions]);
  const devs = useMemo(() => analyse(games), [games, libVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const rg = useMemo(() => repertoireGames(rep, moves, games, devs), [rep, moves, games, devs]);
  const known = shape.ownPositions ? (tr.maturity.young + tr.maturity.mature) / shape.ownPositions : 0;

  const cell = (label: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <dt className="truncate text-xs text-ink-3">{label}</dt>
      <dd className="tnum truncate text-md font-bold">{value}</dd>
    </div>
  );

  return (
    <section aria-label="Repertoire statistics" className="border-b border-line p-3.5">
      <div className="flex items-center">
        <h3 className="text-sm font-semibold">This repertoire</h3>
        <Link to="/stats" className="ms-auto text-xs font-semibold text-brand">
          All statistics
        </Link>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2">
        {cell('Moves', shape.moves)}
        {cell('Lines', shape.lines)}
        {cell('Deepest', shape.depth ? `${Math.ceil(shape.depth / 2)} mv` : '—')}
        {cell('Replies', shape.replies)}
        {cell('Known', pct(known))}
        {cell('Accuracy', pct(tr.accuracy))}
        {cell('Reviews', tr.reviews)}
        {cell('Due', tr.due)}
      </dl>
      {shape.ownPositions > 0 && (
        <div className="mt-3">
          <MaturityBar maturity={tr.maturity} />
        </div>
      )}
      <div className="mt-3">
        <h4 className="mb-1.5 text-xs font-semibold text-ink-3">In your games</h4>
        {rg.games ? (
          <>
            <RecordBar rec={rg} />
            <p className="tnum mt-1.5 text-xs text-ink-2">
              {rg.avgBookPly !== null && <>Prep held for {Math.ceil(rg.avgBookPly / 2)} moves on average · </>}
              {rg.theyLeft} surprise{rg.theyLeft === 1 ? '' : 's'} · {rg.youLeft} forgotten · {rg.prepEnded} past your prep
            </p>
          </>
        ) : (
          <p className="text-xs text-ink-3">
            No imported games reached it yet. <Link to="/games" className="font-semibold text-brand">Import games</Link>
          </p>
        )}
      </div>
      {tr.hardest.length > 0 && (
        <p className="tnum mt-2 text-xs text-ink-2">
          Most-missed position: {tr.hardest[0]!.wrong} of {tr.hardest[0]!.total} wrong.
        </p>
      )}
    </section>
  );
}
