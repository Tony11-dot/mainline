import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Search } from 'lucide-react';
import { epdToFen, playLine, playUci, positionFromFen, toEpd, INITIAL_FEN, type Color, type ExplorerData } from '@mainline/shared';
import { openingIndex, searchOpenings, type OpeningInfo } from '../lib/openings';
import { useLibrary } from '../lib/library';
import { useGames } from '../lib/games';
import { usePrefs } from '../lib/prefs';
import { fetchExplorer } from '../lib/explorer';
import { gamesThrough } from '../lib/stats';
import { WdlBar } from '../panels/ExplorerPanel';
import { RecordBar } from '../ui/stats';
import { MiniBoard } from '../ui/MiniBoard';
import { Button, Skeleton } from '../ui/primitives';
import { inputCls } from '../ui/Sheet';
import { t, tn } from '../lib/i18n';

const POPULAR = [
  'Sicilian Defense: Najdorf Variation',
  'Ruy Lopez',
  'Italian Game',
  "Queen's Gambit Declined",
  'French Defense',
  'Caro-Kann Defense',
  'London System',
  "King's Indian Defense",
  'Nimzo-Indian Defense',
  'Scandinavian Defense',
  'English Opening',
  'Slav Defense',
  'Sicilian Defense: Dragon Variation',
  'Grünfeld Defense',
  'Pirc Defense',
  "Queen's Gambit Accepted",
  'Scotch Game',
  'Catalan Opening',
  'Dutch Defense',
  'Vienna Game',
];

export function OpeningsScreen() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<OpeningInfo[] | null>(null);
  const [selected, setSelected] = useState<OpeningInfo | null>(null);
  const nav = useNavigate();
  const lib = useLibrary();
  useEffect(() => void lib.load(), [lib]);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      if (q.trim()) {
        const r = await searchOpenings(q);
        if (live) setResults(r);
      } else {
        const { all } = await openingIndex();
        const byName = new Map(all.map((o) => [o.name, o]));
        if (live) setResults(POPULAR.map((n) => byName.get(n)).filter(Boolean) as OpeningInfo[]);
      }
    }, 90);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const start = async (o: OpeningInfo, color: Color) => {
    const root = lib.folders.find((f) => !f.deleted && f.parentId === null && f.color === color);
    // Built from the starting position: the opening's moves become the first line of the repertoire,
    // and the guide carries on from where the named opening ends.
    const rep = await lib.createRepertoire({ name: o.name.split(':').at(-1)!.trim() || o.name, color, folderId: root?.id ?? null });
    let fen = INITIAL_FEN;
    for (const uci of o.uci.split(' ')) {
      await lib.addMove(rep.id, fen, uci);
      fen = playUci(positionFromFen(fen), uci).fen;
    }
    nav(`/rep/${rep.id}?guide=1&at=${encodeURIComponent(toEpd(fen))}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center gap-2">
        <Link to="/library" className="-ms-2 flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3" aria-label={t('Back')}>
          <ArrowLeft size={20} className="rtl:rotate-180" />
        </Link>
        <h1 className="text-2xl font-bold">{t('Opening library')}</h1>
      </div>
      <div className="relative mt-4">
        <Search size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          // On phones the keyboard would cover the list before anyone asked to type.
          autoFocus={!matchMedia('(pointer: coarse)').matches}
          className={`${inputCls} ps-10`}
          placeholder={t('Name or ECO, e.g. Najdorf or B90')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t('Search openings')}
        />
      </div>
      {!q && <h2 className="mt-6 mb-2 text-sm font-semibold text-ink-2">{t('Popular')}</h2>}
      <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_340px]">
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
          {results === null
            ? Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="p-3">
                  <Skeleton className="h-14" />
                </li>
              ))
            : results.length === 0
              ? <li className="p-6 text-center text-sm text-ink-2">{t('No opening matches “{query}”.', { query: q })}</li>
              : results.map((o) => (
                  <li key={`${o.name}|${o.uci}`}>
                    <button
                      type="button"
                      onClick={() => setSelected(o)}
                      aria-pressed={selected === o}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors ${selected === o ? 'bg-brand-softer' : 'hover:bg-surface-2'}`}
                    >
                      <MiniBoard fen={o.epd} size={56} lastMove={o.uci.split(' ').at(-1)} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{o.name}</span>
                        <span className="tnum block truncate text-sm text-ink-2">
                          <span className="font-semibold text-ink-3">{o.eco}</span> · <MoveText uci={o.uci} />
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
        </ul>
        <OpeningPreview o={selected} onStart={start} />
      </div>
    </div>
  );
}

function MoveText({ uci }: { uci: string }) {
  const text = useMemo(() => {
    const { moves } = playLine(INITIAL_FEN, uci.split(' '));
    return moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m.san}` : m.san)).join(' ');
  }, [uci]);
  return <bdi>{text}</bdi>;
}

function OpeningPreview({ o, onStart }: { o: OpeningInfo | null; onStart: (o: OpeningInfo, c: Color) => void }) {
  if (!o) return <aside className="hidden rounded-[var(--radius-l)] border border-dashed border-line-strong p-6 text-center text-sm text-ink-3 lg:block">{t('Select an opening to preview it.')}</aside>;
  return (
    <aside className="sticky top-6 self-start rounded-[var(--radius-l)] border border-line bg-surface p-4 shadow-1 max-lg:fixed max-lg:inset-x-3 max-lg:bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+20px)] max-lg:top-auto max-lg:z-[var(--z-sheet)] max-lg:shadow-3">
      <div className="flex gap-3 lg:flex-col">
        <MiniBoard fen={o.epd} size={308} lastMove={o.uci.split(' ').at(-1)} className="max-lg:!size-24" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-ink-3">{o.eco}</p>
          <h3 className="text-md font-bold leading-snug">{o.name}</h3>
          <p className="tnum mt-1 text-sm text-ink-2">
            <MoveText uci={o.uci} />
          </p>
        </div>
      </div>
      <OpeningNumbers o={o} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => onStart(o, 'white')}>{t('Play as White')}</Button>
        <Button onClick={() => onStart(o, 'black')}>{t('Play as Black')}</Button>
      </div>
      <Link to={`/explore?moves=${o.uci.split(' ').join(',')}`} className="mt-2 block text-center text-sm font-semibold text-brand hover:underline">
        {t('Explore this position')}
      </Link>
    </aside>
  );
}

/** Database results for the opening's position, and your own record in games that reached it. */
function OpeningNumbers({ o }: { o: OpeningInfo }) {
  const { rating, speeds } = usePrefs();
  const games = useGames((s) => s.games);
  const loadGames = useGames((s) => s.load);
  const [db, setDb] = useState<{ lichess?: ExplorerData; masters?: ExplorerData } | null>(null);
  useEffect(() => void loadGames(), [loadGames]);
  useEffect(() => {
    const ctrl = new AbortController();
    setDb(null);
    const fen = epdToFen(o.epd);
    void Promise.allSettled([fetchExplorer('lichess', fen, rating, speeds, ctrl.signal), fetchExplorer('masters', fen, rating, speeds, ctrl.signal)]).then(([l, m]) => {
      if (!ctrl.signal.aborted) setDb({ lichess: l.status === 'fulfilled' ? l.value : undefined, masters: m.status === 'fulfilled' ? m.value : undefined });
    });
    return () => ctrl.abort();
  }, [o.epd, rating, speeds]);
  const mine = useMemo(() => gamesThrough(games, o.epd), [games, o.epd]);
  const total = (d?: ExplorerData) => (d ? d.white + d.draws + d.black : 0);
  return (
    <div className="mt-3 flex flex-col gap-2.5 border-t border-line pt-3 text-sm">
      <div>
        <div className="mb-1 flex text-xs text-ink-3">
          <span>{t('Lichess · your rating band')}</span>
          <span className="tnum ms-auto">{db ? (db.lichess ? tn(total(db.lichess), '{n} game', '{n} games') : t('unavailable')) : '…'}</span>
        </div>
        {db?.lichess && total(db.lichess) > 0 ? <WdlBar white={db.lichess.white} draws={db.lichess.draws} black={db.lichess.black} /> : <Skeleton className="h-[18px]" />}
        {db?.masters && total(db.masters) > 0 && <p className="tnum mt-1 text-xs text-ink-3">{t('Masters')}: {tn(total(db.masters), '{n} game', '{n} games')}</p>}
      </div>
      {mine.all.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-3">{t('Your games through this position')}</span>
          {mine.white.games > 0 && (
            <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2 text-xs">
              {t('As White')} <RecordBar rec={mine.white} />
            </div>
          )}
          {mine.black.games > 0 && (
            <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2 text-xs">
              {t('As Black')} <RecordBar rec={mine.black} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
