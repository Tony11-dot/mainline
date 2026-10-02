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
import { Button, PanelNote, Segmented } from '../ui/primitives';
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('Games')}</h1>
        <Link to="/stats" className="inline-flex h-11 items-center gap-2 rounded-[12px] px-3 text-base font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
          <BarChart3 size={18} aria-hidden /> {t('Statistics')}
        </Link>
      </div>
      <p className="mt-1 text-ink-2">{t('See exactly where your real games leave your prep.')}</p>
      <Accounts />

      {g.games.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-l)] border border-dashed border-line-strong">
          <PanelNote icon={Swords} title={t('No games imported yet')}>
            {t('Add your Lichess or Chess.com username above and import. MainLine only looks at the openings.')}
          </PanelNote>
        </div>
      ) : (
        <>
          <dl className="tnum mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label={t('In your repertoire')} value={`${covered.length}/${g.games.length}`} />
            <Tile label={t('You left book')} value={count('you_left_book')} tone="bad" />
            <Tile label={t('Opponent left book')} value={count('opponent_left_book')} tone="warn" />
            <Tile label={t('End of prep')} value={count('end_of_prep')} tone="good" />
          </dl>

          <section className="mt-8">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{t('Where your prep breaks')}</h2>
            </div>
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

          <section className="mt-8">
            <h2 className="mb-2 text-lg font-bold">{t('Your results per line')}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
              {lines.slice(0, 12).map((l) => (
                <li key={l.color + l.path.join()} className="flex items-center gap-3 px-4 py-3">
                  <span className={`size-3 shrink-0 rounded-full ring-1 ring-line-strong ${l.color === 'white' ? 'bg-white' : 'bg-[oklch(0.25_0.015_262)]'}`} aria-label={l.color === 'white' ? t('As White') : t('As Black')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      <bdi>{lineText(l.path)}</bdi>
                    </span>
                    <span className="tnum text-xs text-ink-3">
                      {tn(l.games, '{n} game', '{n} games')} · {t('you score {pct}', { pct: fmtPercent(l.score) })}
                    </span>
                  </span>
                  <span className="w-28 shrink-0">
                    <ResultBar win={l.win} draw={l.draw} loss={l.loss} />
                  </span>
                </li>
              ))}
              {!lines.length && <li className="px-4 py-3 text-sm text-ink-2">{t('No games reached your repertoire yet.')}</li>}
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
    <div className="mt-5 grid gap-3 rounded-[var(--radius-l)] border border-line bg-surface p-4 shadow-1 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-2">Lichess</span>
        <input className={inputCls} value={p.lichessUser} placeholder={me?.lichessUsername ?? t('username')} onChange={(e) => p.set({ lichessUser: e.target.value.trim() })} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label={t('Lichess username')} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-2">Chess.com</span>
        <input className={inputCls} value={p.chesscomUser} placeholder={me?.chesscomUsername ?? t('username')} onChange={(e) => p.set({ chesscomUser: e.target.value.trim() })} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label={t('Chess.com username')} />
      </label>
      <Button variant="primary" icon={Download} loading={g.importing} disabled={!acc.lichess && !acc.chesscom} onClick={() => void run()}>
        {t('Import games')}
      </Button>
      {g.lastImport && <p className="text-xs text-ink-3 sm:col-span-3">{t('Last imported {when} · new games are checked automatically.', { when: new Date(g.lastImport).toLocaleString(intlLocale()) })}</p>}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'bad' | 'warn' }) {
  const c = tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : tone === 'good' ? 'text-good' : '';
  return (
    <div className="rounded-[var(--radius-m)] border border-line bg-surface px-3 py-2.5 shadow-1">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={`text-lg font-bold ${c}`}>{value}</dd>
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
  if (!bps.length) return <p className="mt-3 text-sm text-ink-2">{t('Nothing here — nicely done.')}</p>;
  return (
    <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
      {bps.slice(0, 15).map((b) => {
        const pos = positionFromFen(epdToFen(b.epd));
        const top = b.played[0];
        const topSan = top ? uciToSan(pos, top.uci) : undefined;
        const repId = repFor(b.color, b.epd);
        return (
          <li key={b.kind + b.epd + b.color} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{b.path.length ? <bdi>{lineText(b.path)}</bdi> : t('Start')}</span>
              <span className="text-sm text-ink-2">
                {b.kind === 'opponent_left_book' && topSan && (
                  <>{tx('They played {move}', { move: <b className="text-ink">{topSan}</b> })}</>
                )}
                {b.kind === 'you_left_book' && topSan && (
                  <>
                    {tx('You played {played} instead of {expected} · now due', {
                      played: <b className="text-bad">{topSan}</b>,
                      expected: <b className="text-good">{b.expected.map((u) => uciToSan(pos, u)).join(' / ')}</b>,
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
    <section className="mt-8">
      <h2 className="mb-2 text-lg font-bold">{t('Recent games')}</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
        {games.map((g) => {
          const d = devs.get(g.id);
          const tone = d?.kind === 'you_left_book' ? 'bg-bad-soft text-bad' : d?.kind === 'opponent_left_book' ? 'bg-warn-soft text-[oklch(0.45_0.1_70)] dark:text-warn' : d?.kind === 'end_of_prep' ? 'bg-good-soft text-good' : 'bg-surface-3 text-ink-3';
          return (
            <li key={g.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className={`tnum w-10 shrink-0 text-center font-bold ${g.result === 'win' ? 'text-good' : g.result === 'loss' ? 'text-bad' : 'text-ink-3'}`}>{g.result === 'win' ? t('Won') : g.result === 'loss' ? t('Lost') : t('Draw')}</span>
              <span className="min-w-0 flex-1 truncate">
                {tx('vs {opponent}', { opponent: <b>{g.opponent}</b> })} {g.opponentRating ? <span className="tnum text-ink-3">({g.opponentRating})</span> : null} · <span className="text-ink-3">{speedName(g.speed)}</span>
              </span>
              {d && (
                <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold sm:inline ${tone}`}>
                  {t(KIND_LABEL[d.kind])}
                  {d.kind !== 'not_covered' ? ` · ${t('move {n}', { n: Math.floor(d.ply / 2) + 1 })}` : ''}
                </span>
              )}
              <a href={g.url} target="_blank" rel="noreferrer" className="shrink-0 text-ink-3 hover:text-ink" aria-label={t('Open game')}>
                <ExternalLink size={15} />
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
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Target size={19} className="text-brand" aria-hidden /> {t('Opponent prep')}
      </h2>
      <p className="mt-0.5 text-sm text-ink-2">{t('Enter your next opponent: see what they usually play and where it meets your repertoire.')}</p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (user.trim()) void run();
        }}
      >
        <Segmented label={t('Site')} value={site} onChange={setSite} options={[{ value: 'lichess', label: 'Lichess' }, { value: 'chesscom', label: 'Chess.com' }]} className="w-56" />
        <input className={`${inputCls} min-w-0 flex-1`} value={user} onChange={(e) => setUser(e.target.value.trim())} placeholder={t('Their username')} aria-label={t('Opponent username')} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <Button type="submit" variant="primary" icon={Search} loading={state.loading} disabled={!user}>
          {t('Analyse')}
        </Button>
      </form>
      {state.error && <p className="mt-3 text-sm text-bad">{state.error}</p>}
      {state.meets && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="tnum text-sm text-ink-3">{tn(state.games ?? 0, '{n} recent game analysed.', '{n} recent games analysed.')}</p>
          {state.meets.map(({ color, meets }) => (
            <div key={color}>
              <h3 className="mb-1.5 text-sm font-semibold text-ink-2">{color === 'white' ? t('When you’re White') : t('When you’re Black')}</h3>
              {meets.length === 0 ? (
                <p className="text-sm text-ink-2">{color === 'white' ? t('No overlap with your White repertoire in their games.') : t('No overlap with your Black repertoire in their games.')}</p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
                  {meets.map((m) => {
                    const san = uciToSan(positionFromFen(m.fen), m.theirMove);
                    return (
                      <li key={m.epd + m.theirMove} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className={`size-2 shrink-0 rounded-full ${m.prepared ? 'bg-good' : 'bg-warn'}`} aria-label={m.prepared ? t('prepared') : t('not prepared')} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            <bdi>{lineText(m.path)}</bdi> … {tx('they play {move}', { move: <b>{san}</b> })}
                          </span>
                          <span className="tnum text-xs text-ink-3">
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
    <span className="flex h-2 w-full overflow-hidden rounded-full bg-surface-3" role="img" aria-label={t('{win} won, {draw} drawn, {loss} lost', { win, draw, loss })}>
      <span className="bg-good" style={{ width: `${(win / total) * 100}%` }} />
      <span className="bg-ink-3/50" style={{ width: `${(draw / total) * 100}%` }} />
      <span className="bg-bad" style={{ width: `${(loss / total) * 100}%` }} />
    </span>
  );
}
