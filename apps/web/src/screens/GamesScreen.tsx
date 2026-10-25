import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { BarChart3, Check, Compass, Download, ExternalLink, Flag, Info, Plus, Search, Swords, Target, TriangleAlert } from 'lucide-react';
import {
  INITIAL_FEN,
  breakPoints,
  buildBook,
  epdToFen,
  opponentPrep,
  playUci,
  positionFromFen,
  resultsByLine,
  toEpd,
  uciLineToSan,
  uciToSan,
  type BreakPoint,
  type Color,
  type Deviation,
  type OpponentPrep,
  type PlayedGame,
  type PrepFork,
  type PrepLine,
} from '@mainline/shared';
import { accounts, analyse, useGames } from '../lib/games';
import { useLibrary } from '../lib/library';
import { usePrefs } from '../lib/prefs';
import { useAuth } from '../lib/auth';
import { api, ApiError } from '../lib/api';
import { Button, Segmented } from '../ui/primitives';
import { EmptyState, PageHeader, Pill, SectionHeader, type Tone } from '../ui/kit';
import { inputCls } from '../ui/Sheet';
import { toast } from '../ui/toast';
import { speedName } from '../lib/speeds';
import { fmtPercent, intlLocale, msg, t, tn, tx } from '../lib/i18n';

/** "1.e4 e5 2.Nf3" */
export function lineText(ucis: string[], fen = INITIAL_FEN) {
  const sans = uciLineToSan(fen, ucis);
  return sans.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}.${s}` : s)).join(' ');
}

const KIND_LABEL: Record<Deviation['kind'], string> = {
  you_left_book: msg('You left book'),
  opponent_left_book: msg('Opponent left book'),
  end_of_prep: msg('End of prep'),
  not_covered: msg('Not in your repertoire'),
};

export function GamesScreen() {
  const g = useGames();
  const lib = useLibrary();
  useEffect(() => {
    void g.load();
    void lib.load();
  }, [g, lib]);
  const devs = useMemo(() => analyse(g.games), [g.games, lib.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const covered = g.games.filter((x) => devs.get(x.id)?.kind !== 'not_covered');
  const bps = useMemo(() => breakPoints(g.games, devs), [g.games, devs]);
  const lines = useMemo(() => resultsByLine(g.games, devs), [g.games, devs]);
  const count = (k: Deviation['kind']) => covered.filter((x) => devs.get(x.id)?.kind === k).length;
  const [tab, setTab] = useState<'opponent_left_book' | 'you_left_book' | 'end_of_prep'>('opponent_left_book');

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title={t('Games')}
        large
        trailing={
          <Link to="/stats" className="pressable inline-flex min-h-11 py-1 items-center gap-2 rounded-full bg-brand-soft px-4 text-base font-semibold text-brand-ink hover:bg-brand-soft-2">
            <BarChart3 size={18} aria-hidden /> {t('Statistics')}
          </Link>
        }
      />
      <p className="mt-2 text-md text-ink-2">{t('See exactly where your real games leave your prep.')}</p>
      <Accounts />

      {g.games.length === 0 ? (
        <EmptyState dashed className="mt-8" icon={Swords} title={t('No games imported yet')}>
          {t('Add your Lichess or Chess.com username above and import. MainLine only looks at the openings.')}
        </EmptyState>
      ) : (
        <>
          <dl className="tnum mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={t('In your repertoire')} value={`${covered.length}/${g.games.length}`} />
            <Tile label={t('You left book')} value={count('you_left_book')} tone="bad" />
            <Tile label={t('Opponent left book')} value={count('opponent_left_book')} tone="warn" />
            <Tile label={t('End of prep')} value={count('end_of_prep')} tone="good" />
          </dl>

          <section className="mt-[var(--section-gap)]">
            <SectionHeader title={t('Where your prep breaks')} />
            <Segmented
              label={t('Break type')}
              value={tab}
              onChange={setTab}
              options={[
                { value: 'opponent_left_book', label: t('Surprises') },
                { value: 'you_left_book', label: t('Forgotten') },
                { value: 'end_of_prep', label: t('Prep ended') },
              ]}
            />
            <BreakList bps={bps.filter((b) => b.kind === tab)} />
          </section>

          <section className="mt-[var(--section-gap)]">
            <SectionHeader title={t('Your results per line')} />
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] bg-surface shadow-card">
              {lines.slice(0, 12).map((l) => (
                <li key={l.color + l.path.join()} className="flex items-center gap-3.5 px-5 py-3.5">
                  <span className={`size-3.5 shrink-0 rounded-full ring-1 ring-line-strong ${l.color === 'white' ? 'bg-chess-white' : 'bg-chess-black'}`} role="img" aria-label={l.color === 'white' ? t('As White') : t('As Black')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold [overflow-wrap:anywhere]">
                      <bdi>{lineText(l.path)}</bdi>
                    </span>
                    <span className="tnum text-sm text-ink-2">
                      {tn(l.games, '{n} game', '{n} games')} · {t('you score {pct}', { pct: fmtPercent(l.score) })}
                    </span>
                  </span>
                  <span className="w-20 shrink-0 sm:w-28">
                    <ResultBar win={l.win} draw={l.draw} loss={l.loss} />
                  </span>
                </li>
              ))}
              {!lines.length && <li className="px-5 py-4 text-base text-ink-2">{t('No games reached your repertoire yet.')}</li>}
            </ul>
          </section>

          <RecentGames games={g.games.slice(0, 20)} devs={devs} />
        </>
      )}

      <OpponentPrep scrollTo={g.loaded} />
    </div>
  );
}

function Accounts() {
  const p = usePrefs();
  const me = useAuth((s) => s.me);
  const g = useGames();
  const acc = accounts();
  const run = async () => {
    try {
      const r = await g.importAll();
      toast(
        r.added
          ? tn(r.added, 'Imported {n} game', 'Imported {n} games') + (r.madeDue ? ` · ${tn(r.madeDue, '{n} position you forgot is now due', '{n} positions you forgot are now due')}` : '')
          : t('You’re up to date'),
        { kind: 'success' },
      );
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('Import failed'), { kind: 'error' });
    }
  };
  return (
    <div className="mt-6 grid gap-3 rounded-[var(--radius-l)] bg-surface p-5 shadow-card sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-2">Lichess</span>
        <input className={inputCls} value={p.lichessUser} placeholder={me?.lichessUsername ?? t('username')} onChange={(e) => p.set({ lichessUser: e.target.value.trim() })} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label={t('Lichess username')} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-2">Chess.com</span>
        <input className={inputCls} value={p.chesscomUser} placeholder={me?.chesscomUsername ?? t('username')} onChange={(e) => p.set({ chesscomUser: e.target.value.trim() })} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label={t('Chess.com username')} />
      </label>
      <Button variant="primary" icon={Download} className="h-12" loading={g.importing} disabled={!acc.lichess && !acc.chesscom} onClick={() => void run()}>
        {t('Import games')}
      </Button>
      {g.lastImport && <p className="text-sm text-ink-2 sm:col-span-3">{t('Last imported {when} · new games are checked automatically.', { when: new Date(g.lastImport).toLocaleString(intlLocale()) })}</p>}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'bad' | 'warn' }) {
  const c = tone === 'bad' ? 'text-bad-ink' : tone === 'warn' ? 'text-warn-ink' : tone === 'good' ? 'text-good-ink' : '';
  return (
    <div className="rounded-[var(--radius-l)] bg-surface px-4 py-3.5 shadow-card">
      <dt className="text-sm font-medium text-ink-2">{label}</dt>
      <dd className={`mt-0.5 text-2xl font-bold ${c}`}>{value}</dd>
    </div>
  );
}

/** A repertoire of that colour with the position in its moves. */
function repWith(color: Color, epd: string): string | undefined {
  const lib = useLibrary.getState();
  return lib.reps.find((r) => !r.deleted && r.color === color && lib.moves.some((m) => m.repertoireId === r.id && !m.deleted && (m.fromEpd === epd || m.toEpd === epd)))?.id;
}

function repFor(color: Color, epd: string): string | undefined {
  return repWith(color, epd) ?? useLibrary.getState().reps.find((r) => !r.deleted && r.color === color)?.id;
}

function BreakList({ bps }: { bps: BreakPoint[] }) {
  const nav = useNavigate();
  const lib = useLibrary();
  if (!bps.length) return <p className="mt-4 px-1 text-base text-ink-2">{t('Nothing here — nicely done.')}</p>;
  return (
    <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[var(--radius-l)] bg-surface shadow-card">
      {bps.slice(0, 15).map((b) => {
        const pos = positionFromFen(epdToFen(b.epd));
        const top = b.played[0];
        const topSan = top ? uciToSan(pos, top.uci) : undefined;
        const repId = repFor(b.color, b.epd);
        return (
          <li key={b.kind + b.epd + b.color} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
            <span className="min-w-[min(10rem,100%)] flex-1">
              <span className="block text-base font-semibold break-words">{b.path.length ? <bdi>{lineText(b.path)}</bdi> : t('Start')}</span>
              <span className="text-sm text-ink-2">
                {b.kind === 'opponent_left_book' && topSan && (
                  <>{tx('They played {move}', { move: <b className="text-ink">{topSan}</b> })}</>
                )}
                {b.kind === 'you_left_book' && topSan && (
                  <>
                    {tx('You played {played} instead of {expected} · now due', {
                      played: <b className="text-bad-ink">{topSan}</b>,
                      expected: <b className="text-good-ink">{b.expected.map((u) => uciToSan(pos, u)).join(' / ')}</b>,
                    })}
                  </>
                )}
                {b.kind === 'end_of_prep' && <>{topSan ? tx('Your prep ends here · next move was {move}', { move: <b className="text-ink">{topSan}</b> }) : t('Your prep ends here')}</>}
                <span className="tnum text-ink-3"> · {tn(b.count, '{n} game', '{n} games')}</span>
              </span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              {repId && (
                <Button size="sm" variant="ghost" onClick={() => nav(`/rep/${repId}?at=${encodeURIComponent(b.epd)}`)}>
                  {t('Open')}
                </Button>
              )}
              {b.kind === 'opponent_left_book' && top && repId && (
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={async () => {
                    await lib.addMove(repId, epdToFen(b.epd), top.uci);
                    toast(t('Added {move} — choose your reply', { move: topSan ?? '' }), { kind: 'success', action: { label: t('Open'), run: () => nav(`/rep/${repId}?at=${encodeURIComponent(b.epd)}`) } });
                  }}
                >
                  {t('Add {move}', { move: topSan ?? '' })}
                </Button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RecentGames({ games, devs }: { games: PlayedGame[]; devs: Map<string, Deviation> }) {
  return (
    <section className="mt-[var(--section-gap)]">
      <SectionHeader title={t('Recent games')} />
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] bg-surface shadow-card">
        {games.map((g) => {
          const d = devs.get(g.id);
          const tone: Tone = d?.kind === 'you_left_book' ? 'bad' : d?.kind === 'opponent_left_book' ? 'warn' : d?.kind === 'end_of_prep' ? 'good' : 'neutral';
          return (
            <li key={g.id} className="flex min-h-[52px] flex-wrap items-center gap-3 ps-5 pe-2 py-2 text-base">
              <span className={`tnum min-w-12 shrink-0 font-bold ${g.result === 'win' ? 'text-good-ink' : g.result === 'loss' ? 'text-bad-ink' : 'text-ink-2'}`}>{g.result === 'win' ? t('Won') : g.result === 'loss' ? t('Lost') : t('Draw')}</span>
              <span className="min-w-[min(10rem,100%)] flex-1 [overflow-wrap:anywhere]">
                {tx('vs {opponent}', { opponent: <b>{g.opponent}</b> })} {g.opponentRating ? <span className="tnum text-ink-3">({g.opponentRating})</span> : null} · <span className="text-ink-3">{speedName(g.speed)}</span>
                {d && (
                  <span className="mt-1 block sm:hidden">
                    <Pill tone={tone}>
                      {t(KIND_LABEL[d.kind])}
                      {d.kind !== 'not_covered' ? ` · ${t('move {n}', { n: Math.floor(d.ply / 2) + 1 })}` : ''}
                    </Pill>
                  </span>
                )}
              </span>
              {d && (
                <span className="hidden shrink-0 sm:block">
                  <Pill tone={tone}>
                    {t(KIND_LABEL[d.kind])}
                    {d.kind !== 'not_covered' ? ` · ${t('move {n}', { n: Math.floor(d.ply / 2) + 1 })}` : ''}
                  </Pill>
                </span>
              )}
              <a href={g.url} target="_blank" rel="noreferrer" className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label={t('Open game')}>
                <ExternalLink size={17} aria-hidden />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** `scrollTo` turns true once the games above have loaded; then "#opponent" (Today's row) lands here. */
function OpponentPrep({ scrollTo }: { scrollTo: boolean }) {
  const lib = useLibrary();
  const { hash } = useLocation();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (scrollTo && hash === '#opponent') ref.current?.scrollIntoView({ block: 'start' });
  }, [scrollTo, hash]);
  const [site, setSite] = useState<'lichess' | 'chesscom'>('lichess');
  const [user, setUser] = useState('');
  const [state, setState] = useState<{ loading: boolean; name?: string; games?: PlayedGame[]; error?: string }>({ loading: false });
  const [speed, setSpeed] = useState('all');
  const run = async () => {
    setState({ loading: true });
    try {
      const { games } = await api<{ games: PlayedGame[] }>(`/api/games?${new URLSearchParams({ site, user, max: '500' })}`);
      setSpeed('all');
      setState({ loading: false, name: user, games });
    } catch (e) {
      setState({ loading: false, error: e instanceof ApiError ? e.message : String(e) });
    }
  };
  const speeds = useMemo(() => {
    const n = new Map<string, number>();
    for (const g of state.games ?? []) n.set(g.speed, (n.get(g.speed) ?? 0) + 1);
    // A time control gets its own tab once there's enough of it to prepare from.
    return [...n].filter(([, k]) => k >= 10).sort((a, b) => b[1] - a[1]);
  }, [state.games]);
  const preps = useMemo(() => {
    if (!state.games) return undefined;
    const games = speed === 'all' ? state.games : state.games.filter((g) => g.speed === speed);
    const data = { reps: lib.reps, moves: lib.moves };
    return (['white', 'black'] as const).map((color) => opponentPrep(games, buildBook(data, color)));
  }, [state.games, speed, lib.version]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    // Insets in px, like the kit's rows: at 2× text, rem padding on three nested boxes left the moves a few letters wide.
    <section ref={ref} id="opponent" className="mt-[var(--section-gap)] scroll-mt-4 rounded-[var(--radius-l)] bg-surface p-[20px] shadow-card">
      <h2 className="flex items-center gap-2.5 text-lg font-bold">
        <span className="flex size-9 items-center justify-center rounded-[var(--radius-s)] bg-brand-soft text-brand-ink" aria-hidden>
          <Target size={19} aria-hidden />
        </span>
        {t('Opponent prep')}
      </h2>
      <p className="mt-1.5 text-base text-ink-2">{t('Enter your next opponent: see what they usually play and where it meets your repertoire.')}</p>
      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (user.trim()) void run();
        }}
      >
        <Segmented label={t('Site')} value={site} onChange={setSite} options={[{ value: 'lichess', label: 'Lichess' }, { value: 'chesscom', label: 'Chess.com' }]} className="w-full sm:w-56" />
        <input className={`${inputCls} min-w-0 flex-1`} value={user} onChange={(e) => setUser(e.target.value.trim())} placeholder={t('Their username')} aria-label={t('Opponent username')} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <Button type="submit" variant="primary" icon={Search} loading={state.loading} disabled={!user} className="h-12">
          {t('Analyse')}
        </Button>
      </form>
      {state.loading && (
        <p role="status" className="mt-3 text-sm text-ink-2">
          {t('Reading their recent games. This can take up to half a minute.')}
        </p>
      )}
      {state.error && <p role="alert" className="mt-3 text-sm font-medium text-bad-ink">{state.error}</p>}
      {state.games && preps && (
        <div className="mt-5 flex flex-col gap-7">
          <div className="flex flex-col gap-2.5">
            <p className="tnum text-base font-semibold [overflow-wrap:anywhere]">{tn(state.games.length, '{name}: {n} recent game', '{name}: {n} recent games', { name: state.name ?? '' })}</p>
            {speeds.length > 1 && (
              <Segmented
                className="sm:self-start"
                label={t('Time controls')}
                value={speed}
                onChange={setSpeed}
                options={[{ value: 'all', label: t('All') }, ...speeds.map(([s, n]) => ({ value: s, label: <span className="tnum">{`${speedName(s)} · ${n.toLocaleString(intlLocale())}`}</span> }))]}
              />
            )}
          </div>
          {preps.map((p) => (
            <PrepSide key={p.color + speed} prep={p} />
          ))}
        </div>
      )}
    </section>
  );
}

/** "1…c5" — one move of a line from the start, numbered. */
function moveText(path: string[], ply: number) {
  const san = uciLineToSan(INITIAL_FEN, path.slice(0, ply + 1))[ply] ?? '';
  return `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '…'}${san}`;
}

function PrepSide({ prep }: { prep: OpponentPrep }) {
  const [more, setMore] = useState(false);
  const white = prep.color === 'white';
  const hasRep = useLibrary((s) => s.reps.some((r) => !r.deleted && r.color === prep.color));
  const shown = prep.lines.slice(0, more ? 8 : 3);
  const extra = Math.min(prep.lines.length, 8) - 3;
  return (
    <section aria-label={white ? t('When you’re White') : t('When you’re Black')}>
      <h3 className="flex items-center gap-2.5 text-md font-bold">
        <span className={`size-3.5 shrink-0 rounded-full ring-1 ring-line-strong ${white ? 'bg-chess-white' : 'bg-chess-black'}`} aria-hidden />
        {white ? t('When you’re White') : t('When you’re Black')}
      </h3>
      {prep.games === 0 ? (
        <p className="mt-1 text-sm text-ink-2">{white ? t('They have no games as Black here.') : t('They have no games as White here.')}</p>
      ) : (
        <>
          <p className="tnum mt-0.5 text-sm text-ink-2">{white ? tn(prep.games, 'From {n} game where they had Black', 'From {n} games where they had Black') : tn(prep.games, 'From {n} game where they had White', 'From {n} games where they had White')}</p>
          {!hasRep && <p className="mt-2 text-sm text-ink-2">{white ? t('You have no White repertoire yet: these are the lines to build one for.') : t('You have no Black repertoire yet: these are the lines to build one for.')}</p>}
          {prep.forks.map((f) => (
            <PrepForkCard key={f.path.join()} fork={f} marks={hasRep} />
          ))}
          {shown.length > 0 && (
            <>
              <h4 className="mt-5 mb-2 text-base font-bold">{t('Lines to prepare')}</h4>
              <ol className="flex flex-col gap-2">
                {shown.map((l, i) => (
                  <PrepLineRow key={l.path.join()} line={l} n={i + 1} color={prep.color} />
                ))}
              </ol>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="tnum text-sm text-ink-3">{tn(prep.minGames, 'A line goes on while at least {n} of their games follow it.', 'A line goes on while at least {n} of their games follow it.')}</p>
                {extra > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setMore(!more)}>
                    {more ? t('Show fewer') : tn(extra, 'Show {n} more line', 'Show {n} more lines')}
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Their choices at one of their first decisions, as counts of their games. */
function PrepForkCard({ fork, marks }: { fork: PrepFork; marks: boolean }) {
  const top = fork.choices.slice(0, 4);
  const rest = fork.games - top.reduce((a, c) => a + c.games, 0);
  return (
    <div className="mt-3 rounded-[var(--radius-m)] bg-surface-2 px-[16px] py-[14px]">
      <p className="text-base font-semibold">
        {fork.path.length ? tx('Their answer to {move}', { move: <bdi>{lineText(fork.path)}</bdi> }) : t('Their first move')} <span className="tnum text-sm font-normal text-ink-2">· {tn(fork.games, '{n} game', '{n} games')}</span>
      </p>
      {fork.games === 0 ? (
        <p className="mt-1 text-sm text-ink-2">{t('They haven’t faced it in these games.')}</p>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-2">
          {top.map((c) => (
            // Phones: the move and its count on one line, the bar under them; wider: one row of move, bar, count.
            <li key={c.uci} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(4.5rem,max-content)_minmax(3rem,1fr)_auto]">
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <b className="text-base">
                  <bdi>{moveText([...fork.path, c.uci], fork.path.length)}</bdi>
                </b>
                {marks && (c.prepared ? <Check size={16} className="text-good-ink" role="img" aria-label={t('In your repertoire')} /> : <Pill tone="warn">{t('Not prepared')}</Pill>)}
              </span>
              <span className="order-last col-span-2 h-2 overflow-hidden rounded-full bg-surface-3 sm:order-none sm:col-span-1" aria-hidden>
                <span className="block h-full rounded-full bg-brand" style={{ width: `${(c.games / fork.games) * 100}%` }} />
              </span>
              <span className="tnum text-end text-sm text-ink-2">
                <b className="font-semibold text-ink">{fmtPercent(c.games / fork.games)}</b> · {tn(c.games, '{n} game', '{n} games')}
              </span>
            </li>
          ))}
          {rest > 0 && <li className="tnum text-sm text-ink-3">{tn(rest, 'Other moves: {n} game', 'Other moves: {n} games')}</li>}
        </ul>
      )}
    </div>
  );
}

function PrepLineRow({ line, n, color }: { line: PrepLine; n: number; color: Color }) {
  const nav = useNavigate();
  const lib = useLibrary();
  const sans = uciLineToSan(INITIAL_FEN, line.path);
  // The position where the line leaves your repertoire, and whose move it is there.
  let pos = positionFromFen(INITIAL_FEN);
  for (const u of line.path.slice(0, line.ply)) pos = playUci(pos, u).pos;
  const epd = toEpd(pos);
  const leaves = line.book === 'they_leave' || line.book === 'prep_ends';
  const theirs = pos.turn !== color;
  const next = line.path[line.ply];
  const repId = leaves ? repWith(color, epd) : undefined;
  const nextSan = next ? moveText(line.path, line.ply) : '';
  const scoreTone = line.games >= 5 && line.score <= 0.4 ? 'text-good-ink' : line.games >= 5 && line.score >= 0.6 ? 'text-bad-ink' : '';
  return (
    <li className="rounded-[var(--radius-m)] bg-surface-2 px-[16px] py-[14px]">
      <div className="min-w-0">
        <p className="text-base leading-relaxed font-semibold [overflow-wrap:anywhere]">
          <span className="tnum me-2 inline-flex min-w-[1.6em] justify-center rounded-full bg-surface-3 px-1.5 text-sm font-bold text-ink-2" aria-hidden>
            {n}
          </span>
          <bdi>
            {sans.map((s, i) => (
              <Fragment key={i}>
                {i > 0 && ' '}
                <span className={leaves && i >= line.ply ? (i === line.ply && line.book === 'they_leave' ? 'font-bold text-warn-ink' : 'font-medium text-ink-2') : undefined}>{i % 2 === 0 ? `${i / 2 + 1}.${s}` : s}</span>
              </Fragment>
            ))}
          </bdi>
        </p>
        <p className="tnum mt-1 text-sm text-ink-2">
          {tn(line.games, '{n} of their games went this way', '{n} of their games went this way')} · <span className={scoreTone}>{t('they score {pct}', { pct: fmtPercent(line.score) })}</span> · {t('last played {date}', { date: fmtDay(line.lastPlayed) })}
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-sm font-medium">
          {line.book === 'covered' && !line.rare && (
            <>
              <Check size={16} className="mt-0.5 shrink-0 text-good-ink" aria-hidden />
              <span className="text-good-ink">{t('In your repertoire all the way')}</span>
            </>
          )}
          {line.book === 'covered' && line.rare && (
            <>
              <Info size={16} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
              <span>{line.rare.games ? tn(line.rare.games, 'They’ve faced your {move} only once here', 'They’ve faced your {move} only {n} times here', { move: moveText([...line.path, line.rare.uci], line.path.length) }) : t('They haven’t faced your {move} in these games', { move: moveText([...line.path, line.rare.uci], line.path.length) })}</span>
            </>
          )}
          {line.book === 'they_leave' && (
            <>
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn-ink" aria-hidden />
              <span className="text-warn-ink">{tx('{move} isn’t in your repertoire', { move: <bdi>{nextSan}</bdi> })}</span>
            </>
          )}
          {line.book === 'prep_ends' && (
            <>
              <Flag size={16} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
              <span>{tx('Your repertoire ends after {move}', { move: <bdi>{moveText(line.path, line.ply - 1)}</bdi> })}</span>
            </>
          )}
          {line.book === 'none' && <span className="text-ink-2">{t('Not in your repertoire')}</span>}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {repId && theirs && next && (
            <Button
              size="sm"
              icon={Plus}
              onClick={async () => {
                await lib.addMove(repId, epdToFen(epd), next);
                // A numbered move ("1…c5") is isolated so right-to-left text keeps it in order.
                toast(t('Added {move} — choose your reply', { move: `\u2068${nextSan}\u2069` }), { kind: 'success', action: { label: t('Open'), run: () => nav(`/rep/${repId}?at=${encodeURIComponent(epd)}`) } });
              }}
            >
              {tx('Add {move}', { move: <bdi>{nextSan}</bdi> })}
            </Button>
          )}
          {repId && !theirs && (
            <Button size="sm" variant="ghost" onClick={() => nav(`/rep/${repId}?at=${encodeURIComponent(epd)}`)}>
              {t('Open')}
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={Compass} onClick={() => nav(`/explore?${new URLSearchParams({ moves: line.path.join(','), color })}`)}>
            {t('Explore')}
          </Button>
        </div>
      </div>
    </li>
  );
}

/** "12 Oct", with the year when it isn't this year. */
function fmtDay(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** Your own results: wins green, draws grey, losses red. */
function ResultBar({ win, draw, loss }: { win: number; draw: number; loss: number }) {
  const total = win + draw + loss || 1;
  return (
    <span className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-3" role="img" aria-label={t('{win} won, {draw} drawn, {loss} lost', { win, draw, loss })}>
      <span className="bg-good" style={{ width: `${(win / total) * 100}%` }} />
      <span className="bg-ink-3/50" style={{ width: `${(draw / total) * 100}%` }} />
      <span className="bg-bad" style={{ width: `${(loss / total) * 100}%` }} />
    </span>
  );
}
