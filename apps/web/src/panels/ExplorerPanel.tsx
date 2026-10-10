import { useEffect, useState } from 'react';
import { BookOpen, CloudOff, KeyRound, Timer } from 'lucide-react';
import { ratingBandsFor, wdlPercents, type ExplorerData, type ExplorerMove } from '@mainline/shared';
import { fetchExplorer, type ExplorerSource } from '../lib/explorer';
import { ApiError } from '../lib/api';
import { usePrefs } from '../lib/prefs';
import { PanelNote, Segmented, Skeleton, Button } from '../ui/primitives';
import { startLichessLogin } from '../lib/auth';
import { speedName } from '../lib/speeds';
import { fmtPercent, intlLocale, t, tn } from '../lib/i18n';

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
    <section aria-label={t('Opening explorer')} className="flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <Segmented
          label={t('Explorer database')}
          value={source}
          onChange={setSource}
          options={[
            { value: 'masters', label: t('Masters') },
            { value: 'lichess', label: `Lichess · ${bands[0]}${bands[1] ? `–${bands[1]}` : '+'}` },
          ]}
        />
        {source === 'lichess' && <p className="mt-2 px-1 text-sm text-ink-2">{t('Players rated {range}, {speeds} games', { range: bands.join('–'), speeds: speeds.map(speedName).join(' & ') })}</p>}
      </div>
      {error ? (
        <ExplorerError error={error} />
      ) : !data && loading ? (
        <div className="flex flex-col gap-2 px-4 py-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : data && data.moves.length === 0 ? (
        <PanelNote icon={BookOpen} title={t('No games from here')}>
          {source === 'masters' ? t('Masters never reached this position.') : t('Nobody at this level has played this position yet.')}
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
      <PanelNote icon={KeyRound} title={t('Explorer needs a Lichess link')} action={<Button variant="primary" size="sm" onClick={() => startLichessLogin()}>{t('Sign in with Lichess')}</Button>}>
        {t('Lichess requires a free account to read its opening database. Sign in once and your stats load here.')}
      </PanelNote>
    );
  if (error.status === 429)
    return (
      <PanelNote icon={Timer} title={t('Lichess asked us to slow down')}>
        {tn(error.retryAfter ?? 60, 'Retrying automatically in about {n} second.', 'Retrying automatically in about {n} seconds.')}
      </PanelNote>
    );
  if (error.offline)
    return (
      <PanelNote icon={CloudOff} title={t('You’re offline')}>
        {t('Stats for positions you’ve opened before are saved on this device.')}
      </PanelNote>
    );
  return <PanelNote icon={CloudOff} title={t('Couldn’t load the explorer')}>{error.message}</PanelNote>;
}

/** 1234567 → "1.2M" (or the app language's compact form). */
function fmt(n: number) {
  return new Intl.NumberFormat(intlLocale(), { notation: 'compact', maximumFractionDigits: n >= 10_000_000 || (n >= 10_000 && n < 1_000_000) ? 0 : 1 }).format(n);
}

function MovesTable({ data, onPlay, onHoverMove, highlightUcis }: { data: ExplorerData; onPlay: (uci: string) => void; onHoverMove?: (uci: string | null) => void; highlightUcis?: Set<string> }) {
  return (
    <table className="w-full table-fixed border-collapse text-base">
      <colgroup>
        <col className="w-[max(22%,5.5em)]" />
        <col className="w-[24%]" />
        <col />
      </colgroup>
      <thead className="sr-only">
        <tr>
          <th>{t('Move')}</th>
          <th>{t('Games')}</th>
          <th>{t('White wins, draws, black wins')}</th>
        </tr>
      </thead>
      <tbody>
        {data.moves.map((m) => (
          <MoveRow key={m.uci} m={m} total={data.total} onPlay={onPlay} onHoverMove={onHoverMove} mine={highlightUcis?.has(m.uci)} />
        ))}
        <tr className="border-t border-line text-ink-3">
          <td className="px-4 py-2.5 text-sm font-medium">Σ</td>
          <td className="tnum px-1 py-2.5 text-sm">{fmt(data.total)}</td>
          <td className="py-2.5 pe-4">
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
      aria-label={`${m.san}, ${t('{pct} of games', { pct: fmtPercent(pct / 100) })}`}
    >
      <td className="truncate px-4 py-2.5 font-semibold text-ink">
        {m.san}
        {mine && <span className="ms-1.5 inline-block size-1.5 rounded-full bg-brand align-middle" aria-label={t('in your repertoire')} />}
      </td>
      <td className="tnum px-1 py-2.5 text-ink-2">
        <span className="inline-block w-[3.2ch] text-end font-medium text-ink">{pct < 1 ? '<1' : Math.round(pct)}</span>
        <span className="text-ink-3">%</span> <span className="text-sm text-ink-3">{fmt(m.total)}</span>
      </td>
      <td className="py-2.5 pe-4">
        <WdlBar white={m.white} draws={m.draws} black={m.black} />
      </td>
    </tr>
  );
}

export function WdlBar({ white, draws, black, compact = false }: { white: number; draws: number; black: number; compact?: boolean }) {
  const [w, d, b] = wdlPercents(white, draws, black);
  const seg = (pct: number, cls: string, label: string) =>
    pct > 0 ? (
      <div className={`@container flex items-center justify-center overflow-hidden text-2xs font-semibold ${cls}`} style={{ width: `${pct}%` }} title={`${label} ${pct}%`}>
        {/* The label hides when its segment is narrower than the text (large text, narrow panes). */}
        {!compact && pct >= 14 ? <span className="@max-[2.75em]:hidden">{pct}%</span> : ''}
      </div>
    ) : null;
  return (
    <div className={`tnum flex w-full overflow-hidden rounded-[var(--radius-xs)] ring-1 ring-line ${compact ? 'h-2' : 'h-5'}`} role="img" aria-label={t('White {w}, draws {d}, black {b}', { w: fmtPercent(w / 100), d: fmtPercent(d / 100), b: fmtPercent(b / 100) })}>
      {seg(w, 'bg-[oklch(0.985_0.003_262)] text-[oklch(0.3_0.02_262)]', t('White wins'))}
      {seg(d, 'bg-[oklch(0.72_0.012_262)] text-white', t('Draws'))}
      {seg(b, 'bg-[oklch(0.28_0.015_262)] text-white', t('Black wins'))}
    </div>
  );
}

function TopGames({ data }: { data: ExplorerData }) {
  return (
    <div className="mt-2 border-t border-line px-4 py-4">
      <h3 className="mb-2 text-sm font-bold">{t('Top games')}</h3>
      <ul className="flex flex-col gap-1">
        {data.topGames.slice(0, 6).map((g) => (
          <li key={g.id}>
            <a
              href={`https://lichess.org/${g.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[40px] items-center gap-2 rounded-[var(--radius-xs)] px-2 py-1.5 text-sm hover:bg-surface-3"
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
