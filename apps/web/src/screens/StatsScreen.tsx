import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BarChart3, ChevronRight, Swords, Target } from 'lucide-react';
import { epdToFen } from '@mainline/shared';
import { useTraining } from '../lib/training';
import { useLibrary } from '../lib/library';
import { analyse, useGames } from '../lib/games';
import { openingIndex, openingForLine, type OpeningInfo } from '../lib/openings';
import { gameStats, openingStats, pct, repertoireGames, repertoireShape, trainingStats, type OpeningStat } from '../lib/stats';
import { MiniBoard } from '../ui/MiniBoard';
import { speedName } from '../lib/speeds';
import { Segmented } from '../ui/primitives';
import { EmptyState, ListGroup, ListRow, PageHeader } from '../ui/kit';
import { FormDots, MaturityBar, RecordBar, ReviewsChart, StatGrid, StatSection, StatTile } from '../ui/stats';
import { intlLocale, t, tn } from '../lib/i18n';


/** Every number MainLine knows about you: training, each repertoire, each opening you play, your games. */
export function StatsScreen() {
  const training = useTraining();
  const lib = useLibrary();
  const g = useGames();
  useEffect(() => {
    void training.load();
    void lib.load();
    void g.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ts = useMemo(() => trainingStats(training.reviews, training.cards, { days: 30 }), [training.reviews, training.cards]);
  const devs = useMemo(() => analyse(g.games), [g.games, lib.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const games = useMemo(() => gameStats(g.games), [g.games]);
  const reps = useMemo(
    () =>
      lib.reps
        .filter((r) => !r.deleted)
        .map((rep) => {
          const shape = repertoireShape(rep, lib.moves);
          const tr = trainingStats(training.reviews, training.cards, { positions: shape.positions, days: 30 });
          const known = tr.maturity.young + tr.maturity.mature;
          return { rep, shape, tr, known: shape.ownPositions ? known / shape.ownPositions : 0, games: repertoireGames(rep, lib.moves, g.games, devs) };
        })
        .sort((a, b) => b.shape.moves - a.shape.moves),
    [lib.reps, lib.moves, training.reviews, training.cards, g.games, devs],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title={t('Statistics')} large />
      <p className="mt-2 text-md text-ink-2">{t('Your training, repertoires, openings and games — all computed on this device.')}</p>
      <ListGroup className="mt-5">
        <ListRow to="/focus" icon={Target} title={t('Weak spots')} sub={t('Your weakest moves, openings and lines')} />
      </ListGroup>

      <div className="mt-[var(--section-gap)]">
        <StatSection title={t('Training')}>
          {ts.reviews === 0 && ts.due === 0 ? (
            // Before the first review every tile would read 0 or —; one clear next step instead.
            <Empty text={t('Your training numbers start with your first session.')} to="/train?mode=learn" cta={t('Learn new moves')} />
          ) : (
            <>
              <StatGrid>
                <StatTile label={t('Reviews')} value={ts.reviews.toLocaleString(intlLocale())} sub={t('{n} active days / 30', { n: ts.activeDays30 })} />
                <StatTile label={t('Accuracy')} value={pct(ts.accuracy)} sub={t('7 days {a} · 30 days {b}', { a: pct(ts.accuracy7), b: pct(ts.accuracy30) })} />
                <StatTile label={t('Due now')} value={ts.due} sub={tn(ts.lapses, '{n} lapse so far', '{n} lapses so far')} />
                <StatTile label={t('Answer time')} value={ts.medianMs ? t('{sec} s', { sec: (ts.medianMs / 1000).toLocaleString(intlLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }) }) : '—'} sub={t('median, correct answers')} />
              </StatGrid>
              <div className="mt-3">
                <ReviewsChart daily={ts.daily} />
              </div>
            </>
          )}
          {MaturityTotal(ts.maturity) > 0 && (
            <div className="mt-3 rounded-[var(--radius-l)] bg-surface p-5 shadow-card">
              <h3 className="mb-3 text-md font-bold">{t('Positions by memory strength')}</h3>
              <MaturityBar maturity={ts.maturity} />
            </div>
          )}
          {ts.hardest.length > 0 && <Hardest items={ts.hardest} />}
        </StatSection>

        <StatSection title={t('Repertoires')}>
          {reps.length === 0 ? (
            <Empty text={t('No repertoires yet.')} to="/library/openings" cta={t('Start one')} />
          ) : (
            <ul className="flex flex-col gap-3">
              {reps.map(({ rep, shape, tr, known, games: rg }) => (
                <li key={rep.id}>
                  <Link to={`/rep/${rep.id}`} className="pressable @container block rounded-[var(--radius-l)] bg-surface p-5 shadow-card transition-colors hover:bg-surface-2">
                    <div className="flex items-center gap-2.5">
                      <span role="img" className={`size-3.5 shrink-0 rounded-full ring-1 ring-line-strong ${rep.color === 'white' ? 'bg-chess-white' : 'bg-chess-black'}`} aria-label={rep.color === 'white' ? t('As White') : t('As Black')} />
                      <span className="line-clamp-2 min-w-0 text-md leading-tight font-bold break-words">{rep.name}</span>
                      <ChevronRight size={20} className="ms-auto shrink-0 text-ink-3 rtl:rotate-180" aria-hidden />
                    </div>
                    <dl className="tnum mt-3 grid grid-cols-4 gap-2 text-sm @max-[18rem]:grid-cols-2">
                      <Mini label={t('Moves')} value={shape.moves} />
                      <Mini label={t('Lines')} value={shape.lines} />
                      <Mini label={t('Known')} value={pct(known)} />
                      <Mini label={t('Accuracy')} value={pct(tr.accuracy)} />
                    </dl>
                    <div className="mt-3">{rg.games ? <RecordBar rec={rg} /> : <span className="text-sm text-ink-2">{t('No imported games reached this repertoire yet')}</span>}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </StatSection>

        {g.games.length === 0 ? (
          <StatSection title={t('Games & openings')}>
            <Empty text={t('Import your Lichess or Chess.com games to see your record in every opening.')} to="/games" cta={t('Import games')} icon={Swords} />
          </StatSection>
        ) : (
          <>
            <StatSection title={t('Games')}>
              <StatGrid>
                <StatTile label={t('Games')} value={games.all.games.toLocaleString(intlLocale())} sub={t('score {pct}', { pct: pct(games.all.score) })} />
                <StatTile label={t('Performance')} value={games.performance ?? '—'} sub={t('rating estimate')} />
                <StatTile label={t('Avg opponent')} value={games.avgOpponent ? Math.round(games.avgOpponent) : '—'} />
                <StatTile label={t('Recent form')} value={<FormDots form={games.form.slice(0, 5)} />} sub={t('newest first')} />
              </StatGrid>
              <div className="mt-3 flex flex-col divide-y divide-line rounded-[var(--radius-l)] bg-surface shadow-card">
                <Row label={t('As White')} right={<RecordBar rec={games.white} />} />
                <Row label={t('As Black')} right={<RecordBar rec={games.black} />} />
                {games.bySpeed.map((s) => (
                  <Row key={s.speed} label={speedName(s.speed)} right={<RecordBar rec={s.rec} />} />
                ))}
                {games.bySite.length > 1 && games.bySite.map((s) => <Row key={s.site} label={s.site === 'lichess' ? 'Lichess' : 'Chess.com'} right={<RecordBar rec={s.rec} />} />)}
              </div>
            </StatSection>
            <OpeningsSection />
          </>
        )}
      </div>
    </div>
  );
}

const MaturityTotal = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="hyphens-auto text-xs leading-tight font-medium break-words text-ink-2">{label}</dt>
      <dd className="text-md font-bold break-words">{value}</dd>
    </div>
  );
}

function Row({ label, right }: { label: string; right: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(6rem,8rem)_1fr] items-center gap-3 px-5 py-3.5">
      <span className="text-base font-medium">{label}</span>
      {right}
    </div>
  );
}

function Empty({ text, to, cta, icon = BarChart3 }: { text: string; to: string; cta: string; icon?: typeof BarChart3 }) {
  return (
    <EmptyState
      dashed
      icon={icon}
      title={text}
      action={
        <Link to={to} className="pressable inline-flex min-h-11 py-1 items-center rounded-[var(--radius-control)] bg-brand px-4 font-semibold text-on-brand">
          {cta}
        </Link>
      }
    />
  );
}

function Hardest({ items }: { items: { color: 'white' | 'black'; epd: string; wrong: number; total: number }[] }) {
  const [names, setNames] = useState<Map<string, OpeningInfo | undefined>>(new Map());
  useEffect(() => {
    let live = true;
    void Promise.all(items.map(async (h) => [h.epd, await openingForLine([epdToFen(h.epd)])] as const)).then((rows) => live && setNames(new Map(rows)));
    return () => {
      live = false;
    };
  }, [items]);
  return (
    <div className="mt-3 rounded-[var(--radius-l)] bg-surface p-5 shadow-card">
      <h3 className="text-md font-bold">{t('Positions you miss most')}</h3>
      <ul className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {items.map((h) => (
          <li key={h.color + h.epd} className="shrink-0">
            <Link to={`/explore?${new URLSearchParams({ fen: epdToFen(h.epd), color: h.color })}`} className="block w-[104px]">
              <MiniBoard fen={epdToFen(h.epd)} orientation={h.color} size={104} />
              <div className="tnum mt-1.5 text-sm font-semibold text-bad-ink">
                {t('{wrong} of {total} wrong', { wrong: h.wrong, total: h.total })}
              </div>
              <div className="truncate text-xs text-ink-2">{names.get(h.epd)?.name ?? t('Unnamed position')}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OpeningsSection() {
  const g = useGames();
  const [byEpd, setByEpd] = useState<Map<string, OpeningInfo> | null>(null);
  const [color, setColor] = useState<'white' | 'black'>('white');
  const [grain, setGrain] = useState<'family' | 'variation'>('family');
  const [all, setAll] = useState(false);
  useEffect(() => {
    void openingIndex().then((i) => setByEpd(i.byEpd));
  }, []);
  const rows = useMemo<OpeningStat[]>(() => (byEpd ? openingStats(g.games, byEpd, { family: grain === 'family' }).filter((o) => o.color === color) : []), [byEpd, g.games, grain, color]);
  const shown = all ? rows : rows.slice(0, 12);
  return (
    <StatSection title={t('Openings you play')}>
      <div className="mb-3 flex flex-wrap gap-2">
        <Segmented label={t('Colour')} value={color} onChange={setColor} options={[{ value: 'white', label: t('As White') }, { value: 'black', label: t('As Black') }]} className="min-w-[200px] flex-1" />
        <Segmented label={t('Grouping')} value={grain} onChange={setGrain} options={[{ value: 'family', label: t('Openings') }, { value: 'variation', label: t('Variations') }]} className="min-w-[200px] flex-1" />
      </div>
      {!byEpd ? (
        <p className="py-6 text-center text-base text-ink-2">{t('Loading openings…')}</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-base text-ink-2">{color === 'white' ? t('No games as White yet.') : t('No games as Black yet.')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-l)] bg-surface shadow-card">
          {shown.map((o) => (
            <li key={o.opening.name}>
              <Link to={`/explore?${new URLSearchParams({ fen: epdToFen(o.opening.epd), color })}`} className="grid grid-cols-1 gap-2 px-5 py-3.5 hover:bg-surface-2 sm:grid-cols-[1fr_15rem] sm:items-center sm:gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="tnum shrink-0 rounded-[var(--radius-xs)] bg-brand-soft px-1.5 py-0.5 text-xs font-bold text-brand-ink">{o.opening.eco}</span>
                  <span className="min-w-0 truncate text-base font-semibold">{o.opening.name}</span>
                  <span className="tnum ms-auto shrink-0 text-sm text-ink-2">
                    {tn(o.rec.games, '{n} game', '{n} games')}
                    {o.avgOpponent ? ` · ~${o.avgOpponent}` : ''}
                  </span>
                </div>
                <RecordBar rec={o.rec} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 12 && (
        <button type="button" className="mt-3 h-11 w-full rounded-[var(--radius-control)] text-base font-semibold text-brand-ink hover:bg-brand-softer" onClick={() => setAll((a) => !a)}>
          {all ? t('Show fewer') : t('Show all {n}', { n: rows.length })}
        </button>
      )}
    </StatSection>
  );
}
