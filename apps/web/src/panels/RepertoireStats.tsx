import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import type { Repertoire } from '@mainline/shared';
import { useLibrary } from '../lib/library';
import { useTraining } from '../lib/training';
import { analyse, useGames } from '../lib/games';
import { pct, repertoireGames, repertoireShape, trainingStats } from '../lib/stats';
import { MaturityBar, RecordBar } from '../ui/stats';
import { t, tn } from '../lib/i18n';

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
      <dt className="hyphens-auto text-xs leading-tight font-medium break-words text-ink-2">{label}</dt>
      <dd className="tnum truncate text-lg font-bold">{value}</dd>
    </div>
  );

  return (
    <section aria-label={t('Repertoire statistics')} className="border-b border-line p-4">
      <div className="flex items-center">
        <h3 className="text-md font-bold">{t('This repertoire')}</h3>
        <Link to="/stats" className="ms-auto inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-ink">
          {t('All statistics')}
        </Link>
      </div>
      <dl className="mt-1 grid grid-cols-4 gap-x-2 gap-y-3">
        {cell(t('Moves'), shape.moves)}
        {cell(t('Lines'), shape.lines)}
        {cell(t('Deepest'), shape.depth ? tn(Math.ceil(shape.depth / 2), '{n} move', '{n} moves') : '—')}
        {cell(t('Replies'), shape.replies)}
        {cell(t('Known'), pct(known))}
        {cell(t('Accuracy'), pct(tr.accuracy))}
        {cell(t('Reviews'), tr.reviews)}
        {cell(t('Due'), tr.due)}
      </dl>
      {shape.ownPositions > 0 && (
        <div className="mt-3">
          <MaturityBar maturity={tr.maturity} />
        </div>
      )}
      <div className="mt-3">
        <h4 className="mb-2 text-sm font-bold">{t('In your games')}</h4>
        {rg.games ? (
          <>
            <RecordBar rec={rg} />
            <p className="tnum mt-2 text-sm text-ink-2">
              {rg.avgBookPly !== null && <>{tn(Math.ceil(rg.avgBookPly / 2), 'Prep held for {n} move on average', 'Prep held for {n} moves on average')} · </>}
              {tn(rg.theyLeft, '{n} surprise', '{n} surprises')} · {t('{n} forgotten', { n: rg.youLeft })} · {t('{n} past your prep', { n: rg.prepEnded })}
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-2">
            {t('No imported games reached it yet.')} <Link to="/games" className="font-semibold text-brand-ink">{t('Import games')}</Link>
          </p>
        )}
      </div>
      {tr.hardest.length > 0 && (
        <p className="tnum mt-2.5 text-sm text-ink-2">
          {t('Most-missed position: {wrong} of {total} wrong.', { wrong: tr.hardest[0]!.wrong, total: tr.hardest[0]!.total })}
        </p>
      )}
    </section>
  );
}
