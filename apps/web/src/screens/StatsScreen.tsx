import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BarChart3, ChevronRight, Swords } from 'lucide-react';
import { epdToFen } from '@mainline/shared';
import { useTraining } from '../lib/training';
import { useLibrary } from '../lib/library';
import { analyse, useGames } from '../lib/games';
import { openingIndex, openingForLine, type OpeningInfo } from '../lib/openings';
import { gameStats, openingStats, pct, repertoireGames, repertoireShape, trainingStats, type OpeningStat } from '../lib/stats';
import { MiniBoard } from '../ui/MiniBoard';
import { PanelNote, Segmented } from '../ui/primitives';
import { FormDots, MaturityBar, RecordBar, ReviewsChart, StatGrid, StatSection, StatTile } from '../ui/stats';

const SPEED_LABEL: Record<string, string> = { ultraBullet: 'UltraBullet', bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', classical: 'Classical', correspondence: 'Correspondence', daily: 'Daily' };

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

  const t = useMemo(() => trainingStats(training.reviews, training.cards, { days: 30 }), [training.reviews, training.cards]);
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
      <h1 className="text-2xl font-bold">Statistics</h1>
      <p className="mt-1 text-ink-2">Your training, repertoires, openings and games — all computed on this device.</p>

      <div className="mt-6">
        <StatSection title="Training">
          {t.reviews === 0 && t.due === 0 ? (
            // Before the first review every tile would read 0 or —; one clear next step instead.
            <Empty text="Your training numbers start with your first session." to="/train?mode=learn" cta="Learn new moves" />
          ) : (
            <>
              <StatGrid>
                <StatTile label="Reviews" value={t.reviews.toLocaleString()} sub={`${t.activeDays30} active days / 30`} />
                <StatTile label="Accuracy" value={pct(t.accuracy)} sub={`7 days ${pct(t.accuracy7)} · 30 days ${pct(t.accuracy30)}`} />
                <StatTile label="Due now" value={t.due} sub={`${t.lapses} lapses so far`} />
                <StatTile label="Answer time" value={t.medianMs ? `${(t.medianMs / 1000).toFixed(1)} s` : '—'} sub="median, correct answers" />
              </StatGrid>
              <div className="mt-2">
                <ReviewsChart daily={t.daily} />
              </div>
            </>
          )}
          {MaturityTotal(t.maturity) > 0 && (
            <div className="mt-2 rounded-[var(--radius-l)] border border-line bg-surface p-3.5 shadow-1">
              <h3 className="mb-2.5 text-sm font-semibold">Positions by memory strength</h3>
              <MaturityBar maturity={t.maturity} />
            </div>
          )}
          {t.hardest.length > 0 && <Hardest items={t.hardest} />}
        </StatSection>

        <StatSection title="Repertoires">
          {reps.length === 0 ? (
            <Empty text="No repertoires yet." to="/library/openings" cta="Start one" />
          ) : (
            <ul className="flex flex-col gap-2">
              {reps.map(({ rep, shape, tr, known, games: rg }) => (
                <li key={rep.id}>
                  <Link to={`/rep/${rep.id}`} className="block rounded-[var(--radius-l)] border border-line bg-surface p-3.5 shadow-1 transition-colors hover:bg-surface-2">
                    <div className="flex items-center gap-2">
                      <span className={`size-3 shrink-0 rounded-full ring-1 ring-line-strong ${rep.color === 'white' ? 'bg-white' : 'bg-ink'}`} aria-label={rep.color} />
                      <span className="min-w-0 truncate font-semibold">{rep.name}</span>
                      <ChevronRight size={16} className="ms-auto shrink-0 text-ink-3" aria-hidden />
                    </div>
                    <dl className="tnum mt-2 grid grid-cols-4 gap-2 text-xs">
                      <Mini label="Moves" value={shape.moves} />
                      <Mini label="Lines" value={shape.lines} />
                      <Mini label="Known" value={pct(known)} />
                      <Mini label="Accuracy" value={pct(tr.accuracy)} />
                    </dl>
                    <div className="mt-2.5">{rg.games ? <RecordBar rec={rg} /> : <span className="text-xs text-ink-3">No imported games reached this repertoire yet</span>}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </StatSection>

        {g.games.length === 0 ? (
          <StatSection title="Games & openings">
            <Empty text="Import your Lichess or Chess.com games to see your record in every opening." to="/games" cta="Import games" icon={Swords} />
          </StatSection>
        ) : (
          <>
            <StatSection title="Games">
              <StatGrid>
                <StatTile label="Games" value={games.all.games.toLocaleString()} sub={`score ${pct(games.all.score)}`} />
                <StatTile label="Performance" value={games.performance ?? '—'} sub="rating estimate" />
                <StatTile label="Avg opponent" value={games.avgOpponent ? Math.round(games.avgOpponent) : '—'} />
                <StatTile label="Recent form" value={<FormDots form={games.form.slice(0, 5)} />} sub="newest first" />
              </StatGrid>
              <div className="mt-2 flex flex-col divide-y divide-line rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
                <Row label="As White" right={<RecordBar rec={games.white} />} />
                <Row label="As Black" right={<RecordBar rec={games.black} />} />
                {games.bySpeed.map((s) => (
                  <Row key={s.speed} label={SPEED_LABEL[s.speed] ?? s.speed} right={<RecordBar rec={s.rec} />} />
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
      <dt className="truncate text-ink-3">{label}</dt>
      <dd className="truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}

function Row({ label, right }: { label: string; right: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3 px-3.5 py-2.5">
      <span className="truncate text-sm font-medium">{label}</span>
      {right}
    </div>
  );
}

function Empty({ text, to, cta, icon = BarChart3 }: { text: string; to: string; cta: string; icon?: typeof BarChart3 }) {
  return (
    <div className="rounded-[var(--radius-l)] border border-dashed border-line-strong">
      <PanelNote
        icon={icon}
        title={text}
        action={
          <Link to={to} className="inline-flex h-10 items-center rounded-[12px] bg-brand px-4 text-sm font-semibold text-on-brand">
            {cta}
          </Link>
        }
      />
    </div>
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
    <div className="mt-2 rounded-[var(--radius-l)] border border-line bg-surface p-3.5 shadow-1">
      <h3 className="text-sm font-semibold">Positions you miss most</h3>
      <ul className="mt-2.5 flex gap-3 overflow-x-auto pb-1">
        {items.map((h) => (
          <li key={h.color + h.epd} className="shrink-0">
            <Link to={`/explore?${new URLSearchParams({ fen: epdToFen(h.epd), color: h.color })}`} className="block w-[104px]">
              <MiniBoard fen={epdToFen(h.epd)} orientation={h.color} size={104} />
              <div className="tnum mt-1 text-xs font-semibold text-bad">
                {h.wrong} of {h.total} wrong
              </div>
              <div className="truncate text-[11px] text-ink-3">{names.get(h.epd)?.name ?? 'Unnamed position'}</div>
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
    <StatSection title="Openings you play">
      <div className="mb-2 flex flex-wrap gap-2">
        <Segmented label="Colour" value={color} onChange={setColor} options={[{ value: 'white', label: 'As White' }, { value: 'black', label: 'As Black' }]} className="min-w-[200px] flex-1" />
        <Segmented label="Grouping" value={grain} onChange={setGrain} options={[{ value: 'family', label: 'Openings' }, { value: 'variation', label: 'Variations' }]} className="min-w-[200px] flex-1" />
      </div>
      {!byEpd ? (
        <p className="py-6 text-center text-sm text-ink-3">Loading openings…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">No games as {color} yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
          {shown.map((o) => (
            <li key={o.opening.name}>
              <Link to={`/explore?${new URLSearchParams({ fen: epdToFen(o.opening.epd), color })}`} className="grid grid-cols-1 gap-1.5 px-3.5 py-2.5 hover:bg-surface-2 sm:grid-cols-[1fr_15rem] sm:items-center sm:gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="tnum shrink-0 rounded-[6px] bg-surface-3 px-1.5 py-0.5 text-[11px] font-bold text-ink-2">{o.opening.eco}</span>
                  <span className="min-w-0 truncate text-sm font-medium">{o.opening.name}</span>
                  <span className="tnum ms-auto shrink-0 text-xs text-ink-3">
                    {o.rec.games} game{o.rec.games === 1 ? '' : 's'}
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
        <button type="button" className="mt-2 h-10 w-full rounded-[12px] text-sm font-semibold text-brand hover:bg-brand-soft" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </StatSection>
  );
}
