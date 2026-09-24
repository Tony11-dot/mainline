import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Download, ExternalLink, Plus, Search, Swords, Target } from 'lucide-react';
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

/** "1.e4 e5 2.Nf3" */
export function lineText(ucis: string[], fen = INITIAL_FEN) {
  const sans = uciLineToSan(fen, ucis);
  return sans.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}.${s}` : s)).join(' ');
}

const KIND_LABEL: Record<Deviation['kind'], string> = {
  you_left_book: 'You left book',
  opponent_left_book: 'Opponent left book',
  end_of_prep: 'End of prep',
  not_covered: 'Not in your repertoire',
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
      <h1 className="text-2xl font-bold">Games</h1>
      <p className="mt-1 text-ink-2">See exactly where your real games leave your prep.</p>
      <Accounts />

      {g.games.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-l)] border border-dashed border-line-strong">
          <PanelNote icon={Swords} title="No games imported yet">
            Add your Lichess or Chess.com username above and import. MainLine only looks at the openings.
          </PanelNote>
        </div>
      ) : (
        <>
          <dl className="tnum mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="In your repertoire" value={`${covered.length}/${g.games.length}`} />
            <Tile label="You left book" value={count('you_left_book')} tone="bad" />
            <Tile label="Opponent left book" value={count('opponent_left_book')} tone="warn" />
            <Tile label="End of prep" value={count('end_of_prep')} tone="good" />
          </dl>

          <section className="mt-8">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Where your prep breaks</h2>
            </div>
            <Segmented
              label="Break type"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'opponent_left_book', label: 'Surprises' },
                { value: 'you_left_book', label: 'Forgotten' },
                { value: 'end_of_prep', label: 'Prep ended' },
              ]}
            />
            <BreakList bps={bps.filter((b) => b.kind === tab)} />
          </section>

          <section className="mt-8">
            <h2 className="mb-2 text-lg font-bold">Your results per line</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
              {lines.slice(0, 12).map((l) => (
                <li key={l.color + l.path.join()} className="flex items-center gap-3 px-4 py-3">
                  <span className={`size-3 shrink-0 rounded-full ring-1 ring-line-strong ${l.color === 'white' ? 'bg-white' : 'bg-[oklch(0.25_0.015_262)]'}`} aria-label={`as ${l.color}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{lineText(l.path)}</span>
                    <span className="tnum text-xs text-ink-3">
                      {l.games} game{l.games === 1 ? '' : 's'} · you score {Math.round(l.score * 100)}%
                    </span>
                  </span>
                  <span className="w-28 shrink-0">
                    <ResultBar win={l.win} draw={l.draw} loss={l.loss} />
                  </span>
                </li>
              ))}
              {!lines.length && <li className="px-4 py-3 text-sm text-ink-2">No games reached your repertoire yet.</li>}
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
      toast(r.added ? `Imported ${r.added} game${r.added === 1 ? '' : 's'}${r.madeDue ? ` · ${r.madeDue} position${r.madeDue === 1 ? '' : 's'} you forgot are now due` : ''}` : 'You’re up to date', { kind: 'success' });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Import failed', { kind: 'error' });
    }
  };
  return (
    <div className="mt-5 grid gap-3 rounded-[var(--radius-l)] border border-line bg-surface p-4 shadow-1 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-2">Lichess</span>
        <input className={inputCls} value={p.lichessUser} placeholder={me?.lichessUsername ?? 'username'} onChange={(e) => p.set({ lichessUser: e.target.value.trim() })} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Lichess username" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-2">Chess.com</span>
        <input className={inputCls} value={p.chesscomUser} placeholder="username" onChange={(e) => p.set({ chesscomUser: e.target.value.trim() })} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Chess.com username" />
      </label>
      <Button variant="primary" icon={Download} loading={g.importing} disabled={!acc.lichess && !acc.chesscom} onClick={() => void run()}>
        Import games
      </Button>
      {g.lastImport && <p className="text-xs text-ink-3 sm:col-span-3">Last imported {new Date(g.lastImport).toLocaleString()} · new games are checked automatically.</p>}
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
  if (!bps.length) return <p className="mt-3 text-sm text-ink-2">Nothing here — nicely done.</p>;
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
              <span className="block truncate text-sm font-semibold">{lineText(b.path) || 'Start'}</span>
              <span className="text-sm text-ink-2">
                {b.kind === 'opponent_left_book' && topSan && (
                  <>
                    They played <b className="text-ink">{topSan}</b>
                  </>
                )}
                {b.kind === 'you_left_book' && topSan && (
                  <>
                    You played <b className="text-bad">{topSan}</b> instead of <b className="text-good">{b.expected.map((u) => uciToSan(pos, u)).join(' / ')}</b> · now due
                  </>
                )}
                {b.kind === 'end_of_prep' && <>Your prep ends here{topSan ? <> · next move was <b className="text-ink">{topSan}</b></> : null}</>}
                <span className="tnum text-ink-3"> · {b.count} game{b.count === 1 ? '' : 's'}</span>
              </span>
            </span>
            <span className="flex gap-1.5">
              {repId && (
                <Button size="sm" variant="ghost" onClick={() => nav(`/rep/${repId}?at=${encodeURIComponent(b.epd)}`)}>
                  Open
                </Button>
              )}
              {b.kind === 'opponent_left_book' && top && repId && (
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={async () => {
                    await lib.addMove(repId, epdToFen(b.epd), top.uci);
                    toast(`Added ${topSan} — choose your reply`, { kind: 'success', action: { label: 'Open', run: () => nav(`/rep/${repId}?at=${encodeURIComponent(b.epd)}`) } });
                  }}
                >
                  Add {topSan}
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
      <h2 className="mb-2 text-lg font-bold">Recent games</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
        {games.map((g) => {
          const d = devs.get(g.id);
          const tone = d?.kind === 'you_left_book' ? 'bg-bad-soft text-bad' : d?.kind === 'opponent_left_book' ? 'bg-warn-soft text-[oklch(0.45_0.1_70)] dark:text-warn' : d?.kind === 'end_of_prep' ? 'bg-good-soft text-good' : 'bg-surface-3 text-ink-3';
          return (
            <li key={g.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className={`tnum w-10 shrink-0 text-center font-bold ${g.result === 'win' ? 'text-good' : g.result === 'loss' ? 'text-bad' : 'text-ink-3'}`}>{g.result === 'win' ? 'Won' : g.result === 'loss' ? 'Lost' : 'Draw'}</span>
              <span className="min-w-0 flex-1 truncate">
                vs <b>{g.opponent}</b> {g.opponentRating ? <span className="tnum text-ink-3">({g.opponentRating})</span> : null} · <span className="text-ink-3">{g.speed}</span>
              </span>
              {d && (
                <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold sm:inline ${tone}`}>
                  {KIND_LABEL[d.kind]}
                  {d.kind !== 'not_covered' ? ` · move ${Math.floor(d.ply / 2) + 1}` : ''}
                </span>
              )}
              <a href={g.url} target="_blank" rel="noreferrer" className="shrink-0 text-ink-3 hover:text-ink" aria-label="Open game">
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
        <Target size={19} className="text-brand" aria-hidden /> Opponent prep
      </h2>
      <p className="mt-0.5 text-sm text-ink-2">Enter your next opponent: see what they usually play and where it meets your repertoire.</p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (user.trim()) void run();
        }}
      >
        <Segmented label="Site" value={site} onChange={setSite} options={[{ value: 'lichess', label: 'Lichess' }, { value: 'chesscom', label: 'Chess.com' }]} className="w-56" />
        <input className={`${inputCls} min-w-0 flex-1`} value={user} onChange={(e) => setUser(e.target.value.trim())} placeholder="Their username" aria-label="Opponent username" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <Button type="submit" variant="primary" icon={Search} loading={state.loading} disabled={!user}>
          Analyse
        </Button>
      </form>
      {state.error && <p className="mt-3 text-sm text-bad">{state.error}</p>}
      {state.meets && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="tnum text-sm text-ink-3">{state.games} recent games analysed.</p>
          {state.meets.map(({ color, meets }) => (
            <div key={color}>
              <h3 className="mb-1.5 text-sm font-semibold text-ink-2">When you're {color}</h3>
              {meets.length === 0 ? (
                <p className="text-sm text-ink-2">No overlap with your {color} repertoire in their games.</p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
                  {meets.map((m) => {
                    const san = uciToSan(positionFromFen(m.fen), m.theirMove);
                    return (
                      <li key={m.epd + m.theirMove} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className={`size-2 shrink-0 rounded-full ${m.prepared ? 'bg-good' : 'bg-warn'}`} aria-label={m.prepared ? 'prepared' : 'not prepared'} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            {lineText(m.path)} … they play <b>{san}</b>
                          </span>
                          <span className="tnum text-xs text-ink-3">
                            {Math.round(m.theirShare * 100)}% of their games here · reached in {Math.round(m.reach * 100)}% · {m.prepared ? 'you’re prepared' : 'not in your repertoire'}
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
  const t = win + draw + loss || 1;
  return (
    <span className="flex h-2 w-full overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${win} won, ${draw} drawn, ${loss} lost`}>
      <span className="bg-good" style={{ width: `${(win / t) * 100}%` }} />
      <span className="bg-ink-3/50" style={{ width: `${(draw / t) * 100}%` }} />
      <span className="bg-bad" style={{ width: `${(loss / t) * 100}%` }} />
    </span>
  );
}
