import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { BarChart3, Download, ExternalLink, Plus, Search, Swords, Target } from 'lucide-react';
import {
  INITIAL_FEN,
  breakPoints,
  buildBook,
  epdToFen,
  opponentMeets,
  positionFromFen,
  resultsByLine,
  uciLineToSan,
  uciToSan,
  type BreakPoint,
  type Color,
  type Deviation,
  type OpponentMeet,
  type PlayedGame,
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
          <Link to="/stats" className="pressable inline-flex h-11 items-center gap-2 rounded-full bg-brand-soft px-4 text-base font-semibold text-brand-ink hover:bg-brand-soft-2">
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
                  <span className={`size-3.5 shrink-0 rounded-full ring-1 ring-line-strong ${l.color === 'white' ? 'bg-white' : 'bg-[#111]'}`} role="img" aria-label={l.color === 'white' ? t('As White') : t('As Black')} />
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

      <OpponentPrep />
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

function repFor(color: Color, epd: string): string | undefined {
  const lib = useLibrary.getState();
  const reps = lib.reps.filter((r) => !r.deleted && r.color === color);
  const withPos = reps.find((r) => lib.moves.some((m) => m.repertoireId === r.id && !m.deleted && (m.fromEpd === epd || m.toEpd === epd)));
  return (withPos ?? reps[0])?.id;
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
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold [overflow-wrap:anywhere]">{b.path.length ? <bdi>{lineText(b.path)}</bdi> : t('Start')}</span>
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
            <span className="flex gap-1.5">
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
            <li key={g.id} className="flex min-h-[52px] items-center gap-3 ps-5 pe-2 py-2 text-base">
              <span className={`tnum min-w-12 shrink-0 font-bold ${g.result === 'win' ? 'text-good-ink' : g.result === 'loss' ? 'text-bad-ink' : 'text-ink-2'}`}>{g.result === 'win' ? t('Won') : g.result === 'loss' ? t('Lost') : t('Draw')}</span>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
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

function OpponentPrep() {
  const lib = useLibrary();
  const [site, setSite] = useState<'lichess' | 'chesscom'>('lichess');
  const [user, setUser] = useState('');
  const [state, setState] = useState<{ loading: boolean; games?: number; meets?: { color: Color; meets: OpponentMeet[] }[]; error?: string }>({ loading: false });
  const run = async () => {
    setState({ loading: true });
    try {
      const { games } = await api<{ games: PlayedGame[] }>(`/api/games?${new URLSearchParams({ site, user, max: '300' })}`);
      const data = { reps: lib.reps, moves: lib.moves };
      const meets = (['white', 'black'] as const).map((color) => ({ color, meets: opponentMeets(games, buildBook(data, color)).slice(0, 8) }));
      setState({ loading: false, games: games.length, meets });
    } catch (e) {
      setState({ loading: false, error: e instanceof ApiError ? e.message : String(e) });
    }
  };
  return (
    <section className="mt-[var(--section-gap)] rounded-[var(--radius-l)] bg-surface p-5 shadow-card">
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
      {state.error && <p role="alert" className="mt-3 text-sm font-medium text-bad-ink">{state.error}</p>}
      {state.meets && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="tnum text-sm text-ink-2">{tn(state.games ?? 0, '{n} recent game analysed.', '{n} recent games analysed.')}</p>
          {state.meets.map(({ color, meets }) => (
            <div key={color}>
              <h3 className="mb-2 text-md font-bold">{color === 'white' ? t('When you’re White') : t('When you’re Black')}</h3>
              {meets.length === 0 ? (
                <p className="text-sm text-ink-2">{color === 'white' ? t('No overlap with your White repertoire in their games.') : t('No overlap with your Black repertoire in their games.')}</p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-m)] bg-surface-2">
                  {meets.map((m) => {
                    const san = uciToSan(positionFromFen(m.fen), m.theirMove);
                    return (
                      <li key={m.epd + m.theirMove} className="flex items-center gap-3 px-4 py-3 text-base">
                        <span role="img" className={`size-2.5 shrink-0 rounded-full ${m.prepared ? 'bg-good' : 'bg-warn'}`} aria-label={m.prepared ? t('prepared') : t('not prepared')} />
                        <span className="min-w-0 flex-1">
                          <span className="block [overflow-wrap:anywhere]">
                            <bdi>{lineText(m.path)}</bdi> … {tx('they play {move}', { move: <b>{san}</b> })}
                          </span>
                          <span className="tnum text-sm text-ink-2">
                            {t('{share} of their games here · reached in {reach}', { share: fmtPercent(m.theirShare), reach: fmtPercent(m.reach) })} · {m.prepared ? t('you’re prepared') : t('not in your repertoire')}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
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
