import { createElement, useEffect, useState, type ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { formatEval, playUci, positionFromFen, toEpd, uciToSan, type ExplorerData, type GuideCandidate, type GuideTag } from '@mainline/shared';
import { fmtPercent, intlLocale, msg, t, tn } from '../../lib/i18n';
import { Skeleton, Spinner } from '../../ui/primitives';
import { useOpeningsByEpd } from '../../board/useOpeningName';

export interface ExplorerPair {
  lichess?: ExplorerData;
  masters?: ExplorerData;
  loading: boolean;
}

/** Each tag, and the exact rule behind it (shown in the panel's "What the tags mean"). */
const TAGS: Record<GuideTag, { icon: string; label: string; rule: string; tone: string }> = {
  yours: { icon: '✅', label: msg('In this line'), rule: msg('Already saved in this line.'), tone: 'bg-brand-soft text-brand-ink' },
  family: { icon: '🔁', label: msg('In your other lines'), rule: msg('Another line in this folder plays it here — keeping your lines alike makes them easier to remember.'), tone: 'bg-brand-soft text-brand-ink' },
  proven: { icon: '🎯', label: msg('Works for you'), rule: msg('In your own games from this position, you scored 60% or more after this move (at least 5 games).'), tone: 'bg-good-soft text-good' },
  trouble: { icon: '🩹', label: msg('Trouble for you'), rule: msg('In your own games from this position, you scored 40% or less after this move (at least 3 games).'), tone: 'bg-bad-soft text-bad' },
  fits: { icon: '🧩', label: msg('Goes with your repertoire'), rule: msg('Leads to a position another of your repertoires already covers.'), tone: 'bg-brand-soft text-brand-ink' },
  dubious: { icon: '🤨', label: msg('Dubious'), rule: msg('The engine rates it clearly worse than the best move (roughly a pawn).'), tone: 'bg-bad-soft text-bad' },
  book: { icon: '📖', label: msg('By the book'), rule: msg('The move masters play most here.'), tone: 'bg-surface-3 text-ink-2' },
  engine: { icon: '🤖', label: msg('Engine’s pick'), rule: msg('The engine’s best move, or within about a tenth of a pawn of it.'), tone: 'bg-good-soft text-good' },
  gem: { icon: '💎', label: msg('Hidden gem'), rule: msg('Nearly as good as the engine’s best, yet rarely played by masters.'), tone: 'bg-[oklch(0.94_0.04_300)] text-[oklch(0.42_0.14_300)] dark:bg-[oklch(0.32_0.07_300)] dark:text-[oklch(0.85_0.08_300)]' },
  club: { icon: '🏆', label: msg('Club crusher'), rule: msg('The best score at your rating, over enough games that it isn’t luck, and the engine says it’s sound.'), tone: 'bg-warn-soft text-[oklch(0.45_0.1_70)] dark:text-warn' },
  crowd: { icon: '🍿', label: msg('Crowd favourite'), rule: msg('Played most at your rating.'), tone: 'bg-surface-3 text-ink-2' },
  surprise: { icon: '🎁', label: msg('Surprise weapon'), rule: msg('Rare among masters, yet it scores clearly above 50% at your rating and holds up with the engine.'), tone: 'bg-warn-soft text-[oklch(0.45_0.1_70)] dark:text-warn' },
};

/** The tag's icon alone, pinned on the board's suggestion arrows. */
export const TAG_PIN = Object.fromEntries(Object.entries(TAGS).map(([k, v]) => [k, v.icon])) as Record<GuideTag, string>;

/** The guided builder's move picker: the top candidates for whoever is to move, rated from their side. */
export function GuidePanel(props: {
  fen: string;
  own: boolean;
  candidates: GuideCandidate[];
  explorer: ExplorerPair;
  searching: boolean;
  onPlay: (uci: string) => void;
  onHover: (uci: string | null) => void;
}) {
  const { fen, own, candidates, explorer, searching, onPlay, onHover } = props;
  const pos = positionFromFen(fen);
  const [all, setAll] = useState(false);
  const [legend, setLegend] = useState(false);
  useEffect(() => setAll(false), [fen]);

  const names = useOpeningsByEpd();
  /** The named opening or variation a move leads to, when that position has a name of its own. */
  const reached = (uci: string) => {
    if (!names) return undefined;
    try {
      return names.get(toEpd(playUci(pos, uci).fen))?.name;
    } catch {
      return undefined;
    }
  };

  const shown = all ? candidates : candidates.slice(0, 5);
  return (
    <section className="flex flex-col" aria-label={own ? t('Your move') : t('Their move')}>
      <Header
        title={own ? t('Your move') : t('Their move')}
        hint={own ? (candidates.length ? t('The arrow shows the top pick. Play it, drag another piece, or tap a row.') : undefined) : candidates.length ? t('You decide how they play: pick a reply, or play any move for them on the board.') : undefined}
        busy={searching || explorer.loading}
        action={
          <button type="button" onClick={() => setLegend((v) => !v)} aria-expanded={legend} aria-label={t('What the tags mean')} title={t('What the tags mean')} className="-me-1 ms-auto flex size-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink">
            <CircleHelp size={17} aria-hidden />
          </button>
        }
      />
      {legend && <Legend />}
      {candidates.length === 0 ? (
        explorer.loading || searching ? (
          <Rows />
        ) : own ? (
          <p className="px-4 pb-4 text-sm text-ink-2">{t('Not enough data yet')} — {t('Play your first move on the board.')}</p>
        ) : (
          <p className="px-4 pb-4 text-sm text-ink-2">{t('Opponent left book')} — {t('Play the moves you expect from your opponent.')}</p>
        )
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {shown.map((c, i) => {
            const name = reached(c.uci);
            return (
            <li key={c.uci}>
              <button
                type="button"
                onClick={() => onPlay(c.uci)}
                onPointerEnter={() => onHover(c.uci)}
                onPointerLeave={() => onHover(null)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-surface-2 ${i === 0 ? 'bg-brand-softer' : ''}`}
                aria-label={`${c.san ?? uciToSan(pos, c.uci)}${name ? `, ${name}` : ''}${c.tags.length ? ` — ${c.tags.map((g) => t(TAGS[g].label)).join(', ')}` : ''}`}
              >
                <PieceIcon fen={fen} uci={c.uci} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <bdi className="tnum me-1 text-md font-bold">{c.san ?? uciToSan(pos, c.uci)}</bdi>
                    {c.tags.slice(0, 2).map((g) => (
                      <Tag key={g} tag={g} />
                    ))}
                  </div>
                  {name && (
                    <p className="mt-0.5 truncate text-xs font-medium text-ink-2" title={name}>
                      <bdi>{name}</bdi>
                    </p>
                  )}
                  <div className="tnum mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-2">
                    <span title={t('Share of master games')}>
                      {t('Masters')} {c.masterShare === undefined ? '—' : fmtShare(c.masterShare)}
                    </span>
                    <span title={own ? t('Your side’s score at your rating') : t('Their score at your rating')}>
                      {t('Club')} {c.practical === undefined ? '—' : fmtPercent(c.practical)}
                    </span>
                    {c.games > 0 && <span>{tn(c.games, '{n} game', '{n} games')}</span>}
                    {c.mine && (
                      <span className="font-semibold text-ink" title={t('Your score after this move in your own games')}>
                        {tn(c.mine.games, 'You: {score} in {n} game', 'You: {score} in {n} games', { score: fmtPercent(c.mine.score) })}
                      </span>
                    )}
                  </div>
                </div>
                <span className="tnum shrink-0 rounded-md bg-surface-3 px-2 py-1 text-sm font-bold" title={t('{eval} after this move', { eval: formatEval(c.line) })} dir="ltr">
                  {c.line ? formatEval(c.line) : searching ? <Spinner size={12} /> : '—'}
                </span>
              </button>
            </li>
            );
          })}
          {candidates.length > 5 && (
            <li>
              <button type="button" onClick={() => setAll((a) => !a)} className="w-full px-3 py-2.5 text-sm font-semibold text-brand hover:bg-surface-2">
                {all ? t('Show fewer') : t('Show all {n}', { n: candidates.length })}
              </button>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}

function Header({ title, hint, busy, action }: { title: string; hint?: string; busy: boolean; action?: ReactNode }) {
  return (
    <header className="px-3 pt-3 pb-2">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        {title}
        {busy && <Spinner size={12} />}
        {action}
      </h2>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </header>
  );
}

function Legend() {
  return (
    <div className="mx-3 mb-3 rounded-[var(--radius-m)] bg-surface-2 p-3">
      <h3 className="text-xs font-bold">{t('What the tags mean')}</h3>
      <dl className="mt-2 flex flex-col gap-2">
        {(Object.keys(TAGS) as GuideTag[]).map((g) => (
          <div key={g} className="flex flex-col items-start gap-1">
            <dt>
              <Tag tag={g} />
            </dt>
            <dd className="text-xs text-ink-2">{t(TAGS[g].rule)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-ink-3">{t('Engine tags appear once the engine has searched deep enough. Masters: share of master games. Club: your side’s score at your rating.')}</p>
      <p className="mt-1 text-xs text-ink-3">{t('You: your score after the move in your imported games (Games tab).')}</p>
    </div>
  );
}

function Rows() {
  return (
    <div className="flex flex-col gap-2 px-3 pb-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

export function Tag({ tag }: { tag: GuideTag }) {
  const d = TAGS[tag];
  return (
    <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap ${d.tone}`} title={t(d.rule)}>
      <span aria-hidden>{d.icon}</span>
      {t(d.label)}
    </span>
  );
}

/** The moving piece, drawn with the board's own piece set. */
function PieceIcon({ fen, uci }: { fen: string; uci: string }) {
  const piece = positionFromFen(fen).board.get(squareIndex(uci.slice(0, 2)));
  if (!piece) return <span className="size-9 shrink-0" />;
  return <span className="cg-wrap guide-piece size-9 shrink-0" aria-hidden>{createElement('piece', { className: `${piece.color} ${piece.role}` })}</span>;
}

/** Shares under 1% keep one significant digit, so a rare move never reads as "0%". */
const fmtShare = (x: number) => (x > 0 && x < 0.01 ? new Intl.NumberFormat(intlLocale(), { style: 'percent', maximumSignificantDigits: 1 }).format(x) : fmtPercent(x));

const squareIndex = (sq: string) => (sq.charCodeAt(0) - 97) + 8 * (Number(sq[1]) - 1);
