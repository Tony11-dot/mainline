import { useEffect, useState } from 'react';
import { BookOpen, CloudOff, KeyRound, Timer } from 'lucide-react';
import { ratingBandsFor, wdlPercents, type ExplorerData, type ExplorerMove } from '@mainline/shared';
import { fetchExplorer, type ExplorerSource } from '../lib/explorer';
import { ApiError } from '../lib/api';
import { usePrefs } from '../lib/prefs';
import { PanelNote, Segmented, Skeleton, Button } from '../ui/primitives';
import { startLichessLogin } from '../lib/auth';

export function useExplorer(source: ExplorerSource, fen: string, enabled = true) {
  const { rating, speeds } = usePrefs();
  const [state, setState] = useState<{ data?: ExplorerData; error?: ApiError; loading: boolean }>({ loading: true });
  const [retryTick, setRetryTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setState((s) => ({ data: s.data?.epd && s.data.source === source ? s.data : undefined, loading: true }));
    // Small debounce so scrubbing through a line doesn't fire a request per ply.
    const t = setTimeout(() => {
      fetchExplorer(source, fen, rating, speeds, ctrl.signal)
        .then((data) => setState({ data, loading: false }))
        .catch((e) => {
          if ((e as Error).name === 'AbortError') return;
          setState({ error: e instanceof ApiError ? e : new ApiError(500, 'error', String(e)), loading: false });
        });
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [source, fen, rating, speeds, enabled, retryTick]);

  // Auto-retry after Lichess' 60 s cool-down.
  useEffect(() => {
    if (state.error?.status !== 429) return;
    const t = setTimeout(() => setRetryTick((x) => x + 1), (state.error.retryAfter ?? 60) * 1000);
    return () => clearTimeout(t);
  }, [state.error]);

  return state;
}

export function ExplorerPanel({ fen, onPlay, onHoverMove, highlightUcis }: { fen: string; onPlay: (uci: string) => void; onHoverMove?: (uci: string | null) => void; highlightUcis?: Set<string> }) {
  const [source, setSource] = useState<ExplorerSource>('masters');
  const { rating, speeds } = usePrefs();
  const { data, error, loading } = useExplorer(source, fen);
  const bands = ratingBandsFor(rating);

  return (
    <section aria-label="Opening explorer" className="flex flex-col">
      <div className="px-3 pt-3 pb-2">
        <Segmented
          label="Explorer database"
          value={source}
          onChange={setSource}
          options={[
            { value: 'masters', label: 'Masters' },
            { value: 'lichess', label: `Lichess · ${bands[0]}${bands[1] ? `–${bands[1]}` : '+'}` },
          ]}
        />
        {source === 'lichess' && <p className="mt-1.5 px-1 text-xs text-ink-3">Players rated {bands.join('–')}, {speeds.join(' & ')} games</p>}
      </div>
      {error ? (
        <ExplorerError error={error} />
      ) : !data && loading ? (
        <div className="flex flex-col gap-2 px-3 py-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-7" />
          ))}
        </div>
      ) : data && data.moves.length === 0 ? (
        <PanelNote icon={BookOpen} title="No games from here">
          {source === 'masters' ? 'Masters never reached this position.' : 'Nobody at this level has played this position yet.'}
        </PanelNote>
      ) : data ? (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <MovesTable data={data} onPlay={onPlay} onHoverMove={onHoverMove} highlightUcis={highlightUcis} />
          {data.topGames.length > 0 && <TopGames data={data} />}
        </div>
      ) : null}
    </section>
  );
}

function ExplorerError({ error }: { error: ApiError }) {
  if (error.notConfigured || error.status === 401)
    return (
      <PanelNote icon={KeyRound} title="Explorer needs a Lichess link" action={<Button variant="primary" size="sm" onClick={() => startLichessLogin()}>Sign in with Lichess</Button>}>
        Lichess requires a free account to read its opening database. Sign in once and your stats load here.
      </PanelNote>
    );
  if (error.status === 429)
    return (
      <PanelNote icon={Timer} title="Lichess asked us to slow down">
        Retrying automatically in about {error.retryAfter ?? 60} seconds.
      </PanelNote>
    );
  if (error.offline)
    return (
      <PanelNote icon={CloudOff} title="You're offline">
        Stats for positions you've opened before are saved on this device.
      </PanelNote>
    );
  return <PanelNote icon={CloudOff} title="Couldn't load the explorer">{error.message}</PanelNote>;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function MovesTable({ data, onPlay, onHoverMove, highlightUcis }: { data: ExplorerData; onPlay: (uci: string) => void; onHoverMove?: (uci: string | null) => void; highlightUcis?: Set<string> }) {
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <colgroup>
        <col className="w-[22%]" />
        <col className="w-[24%]" />
        <col />
      </colgroup>
      <thead className="sr-only">
        <tr>
          <th>Move</th>
          <th>Games</th>
          <th>White wins, draws, black wins</th>
        </tr>
      </thead>
      <tbody>
        {data.moves.map((m) => (
          <MoveRow key={m.uci} m={m} total={data.total} onPlay={onPlay} onHoverMove={onHoverMove} mine={highlightUcis?.has(m.uci)} />
        ))}
        <tr className="border-t border-line text-ink-3">
          <td className="px-3 py-2 text-xs font-medium">Σ</td>
          <td className="tnum px-1 py-2 text-xs">{fmt(data.total)}</td>
          <td className="py-2 pr-3">
            <WdlBar white={data.white} draws={data.draws} black={data.black} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function MoveRow({ m, total, onPlay, onHoverMove, mine }: { m: ExplorerMove; total: number; onPlay: (uci: string) => void; onHoverMove?: (uci: string | null) => void; mine?: boolean }) {
  const pct = total ? (m.total / total) * 100 : 0;
  return (
    <tr
      className={`cursor-pointer border-t border-line transition-colors duration-100 first:border-t-0 hover:bg-brand-softer ${mine ? 'bg-brand-softer' : ''}`}
      onClick={() => onPlay(m.uci)}
      onMouseEnter={() => onHoverMove?.(m.uci)}
      onMouseLeave={() => onHoverMove?.(null)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay(m.uci);
        }
      }}
      aria-label={`${m.san}, ${Math.round(pct)}% of games`}
    >
      <td className="truncate px-3 py-2 font-semibold text-ink">
        {m.san}
        {mine && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-brand align-middle" aria-label="in your repertoire" />}
      </td>
      <td className="tnum px-1 py-2 text-ink-2">
        <span className="inline-block w-[3.2ch] text-right font-medium text-ink">{pct < 1 ? '<1' : Math.round(pct)}</span>
        <span className="text-ink-3">%</span> <span className="text-xs text-ink-3">{fmt(m.total)}</span>
      </td>
      <td className="py-2 pr-3">
        <WdlBar white={m.white} draws={m.draws} black={m.black} />
      </td>
    </tr>
  );
}

export function WdlBar({ white, draws, black, compact = false }: { white: number; draws: number; black: number; compact?: boolean }) {
  const [w, d, b] = wdlPercents(white, draws, black);
  const seg = (pct: number, cls: string, label: string) =>
    pct > 0 ? (
      <div className={`flex items-center justify-center overflow-hidden text-[10.5px] font-semibold ${cls}`} style={{ width: `${pct}%` }} title={`${label} ${pct}%`}>
        {!compact && pct >= 14 ? `${pct}%` : ''}
      </div>
    ) : null;
  return (
    <div className={`tnum flex w-full overflow-hidden rounded-[6px] ring-1 ring-line ${compact ? 'h-2' : 'h-[18px]'}`} role="img" aria-label={`White ${w}%, draws ${d}%, black ${b}%`}>
      {seg(w, 'bg-[oklch(0.985_0.003_262)] text-[oklch(0.3_0.02_262)]', 'White wins')}
      {seg(d, 'bg-[oklch(0.72_0.012_262)] text-white', 'Draws')}
      {seg(b, 'bg-[oklch(0.28_0.015_262)] text-white', 'Black wins')}
    </div>
  );
}

function TopGames({ data }: { data: ExplorerData }) {
  return (
    <div className="mt-2 border-t border-line px-3 py-3">
      <h3 className="mb-2 text-xs font-semibold text-ink-3">Top games</h3>
      <ul className="flex flex-col gap-1">
        {data.topGames.slice(0, 6).map((g) => (
          <li key={g.id}>
            <a
              href={`https://lichess.org/${g.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-sm hover:bg-surface-3"
            >
              <span className={`tnum w-8 shrink-0 text-center text-xs font-bold ${g.winner === 'white' ? 'text-ink' : g.winner === 'black' ? 'text-ink' : 'text-ink-3'}`}>
                {g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½'}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{shortName(g.white.name)}</span> <span className="tnum text-xs text-ink-3">{g.white.rating}</span>
                <span className="text-ink-3"> – </span>
                <span className="font-medium">{shortName(g.black.name)}</span> <span className="tnum text-xs text-ink-3">{g.black.rating}</span>
              </span>
              <span className="tnum shrink-0 text-xs text-ink-3">{g.year}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const shortName = (n: string) => n.split(',')[0] ?? n;
