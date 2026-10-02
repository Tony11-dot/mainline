import { createElement, useEffect, useState } from 'react';
import { formatEval, positionFromFen, uciToSan, type ExplorerData, type GuideCandidate, type GuideTag } from '@mainline/shared';
import { fetchExplorer } from '../../lib/explorer';
import { usePrefs } from '../../lib/prefs';
import { fmtPercent, msg, t, tn } from '../../lib/i18n';
import { Skeleton, Spinner } from '../../ui/primitives';

export interface ExplorerPair {
  lichess?: ExplorerData;
  masters?: ExplorerData;
  loading: boolean;
}

/** Lichess (your rating band) and masters numbers for a position. */
export function useExplorerPair(fen: string, enabled = true): ExplorerPair {
  const { rating, speeds } = usePrefs();
  const [ex, setEx] = useState<ExplorerPair>({ loading: true });
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setEx({ loading: true });
    void Promise.allSettled([fetchExplorer('lichess', fen, rating, speeds, ctrl.signal), fetchExplorer('masters', fen, rating, speeds, ctrl.signal)]).then(([l, m]) => {
      if (ctrl.signal.aborted) return;
      setEx({ lichess: l.status === 'fulfilled' ? l.value : undefined, masters: m.status === 'fulfilled' ? m.value : undefined, loading: false });
    });
    return () => ctrl.abort();
  }, [fen, rating, speeds, enabled]);
  return ex;
}

const TAGS: Record<GuideTag, { icon: string; label: string; tone: string }> = {
  yours: { icon: '✅', label: msg('In your repertoire'), tone: 'bg-brand-soft text-brand-ink' },
  fits: { icon: '🧩', label: msg('Goes with your repertoire'), tone: 'bg-brand-soft text-brand-ink' },
  book: { icon: '📖', label: msg('By the book'), tone: 'bg-surface-3 text-ink-2' },
  engine: { icon: '🤖', label: msg('Engine’s pick'), tone: 'bg-good-soft text-good' },
  gem: { icon: '💎', label: msg('Hidden gem'), tone: 'bg-[oklch(0.94_0.04_300)] text-[oklch(0.42_0.14_300)] dark:bg-[oklch(0.32_0.07_300)] dark:text-[oklch(0.85_0.08_300)]' },
  club: { icon: '🏆', label: msg('Club crusher'), tone: 'bg-warn-soft text-[oklch(0.45_0.1_70)] dark:text-warn' },
  crowd: { icon: '🍿', label: msg('Crowd favourite'), tone: 'bg-surface-3 text-ink-2' },
  surprise: { icon: '🎁', label: msg('Surprise weapon'), tone: 'bg-warn-soft text-[oklch(0.45_0.1_70)] dark:text-warn' },
  risky: { icon: '🎲', label: msg('Living dangerously'), tone: 'bg-bad-soft text-bad' },
};

/** The guided builder's move picker: the top candidates for your move, or what they're likely to reply. */
export function GuidePanel(props: {
  fen: string;
  own: boolean;
  candidates: GuideCandidate[];
  explorer: ExplorerPair;
  searching: boolean;
  /** Replies already in the repertoire at an opponent position. */
  prepared: Set<string>;
  replying: boolean;
  onPlay: (uci: string) => void;
  onHover: (uci: string | null) => void;
}) {
  const { fen, own, candidates, explorer, searching, replying, onPlay, onHover } = props;
  const pos = positionFromFen(fen);
  const [all, setAll] = useState(false);
  useEffect(() => setAll(false), [fen]);

  if (!own) {
    const total = explorer.lichess?.total ?? 0;
    const replies = (explorer.lichess?.moves ?? []).filter((m) => m.total > 0).slice(0, 6);
    return (
      <section className="flex flex-col" aria-label={t('Their move')}>
        <Header title={t('Their move')} hint={replying ? t('Opponent is moving…') : replies.length ? t('Pick a reply to prepare for it.') : undefined} busy={replying || explorer.loading} />
        {explorer.loading ? (
          <Rows />
        ) : replies.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-ink-2">{t('Opponent left book')} — {t('Play the moves you expect from your opponent.')}</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line">
            {replies.map((m) => (
              <li key={m.uci}>
                <button type="button" onClick={() => onPlay(m.uci)} onPointerEnter={() => onHover(m.uci)} onPointerLeave={() => onHover(null)} className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-surface-2">
                  <PieceIcon fen={fen} uci={m.uci} />
                  <bdi className="tnum min-w-[3.5ch] text-md font-bold">{m.san}</bdi>
                  {props.prepared.has(m.uci) && <Tag tag="yours" />}
                  <span className="tnum ms-auto text-sm text-ink-2">{t('{pct} of games', { pct: fmtPercent(m.total / total) })}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }

  const shown = all ? candidates : candidates.slice(0, 5);
  return (
    <section className="flex flex-col" aria-label={t('Your move')}>
      <Header title={t('Your move')} hint={candidates.length ? t('The arrow shows the top pick. Play it, drag another piece, or tap a row.') : undefined} busy={searching || explorer.loading} />
      {candidates.length === 0 ? (
        explorer.loading || searching ? <Rows /> : <p className="px-4 pb-4 text-sm text-ink-2">{t('Not enough data yet')} — {t('Play your first move on the board.')}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {shown.map((c, i) => (
            <li key={c.uci}>
              <button
                type="button"
                onClick={() => onPlay(c.uci)}
                onPointerEnter={() => onHover(c.uci)}
                onPointerLeave={() => onHover(null)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-surface-2 ${i === 0 ? 'bg-brand-softer' : ''}`}
                aria-label={`${c.san ?? uciToSan(pos, c.uci)}${c.tags.length ? ` — ${c.tags.map((g) => t(TAGS[g].label)).join(', ')}` : ''}`}
              >
                <PieceIcon fen={fen} uci={c.uci} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <bdi className="tnum me-1 text-md font-bold">{c.san ?? uciToSan(pos, c.uci)}</bdi>
                    {c.tags.slice(0, 2).map((g) => (
                      <Tag key={g} tag={g} />
                    ))}
                  </div>
                  <div className="tnum mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-2">
                    <span title={t('Share of master games')}>
                      {t('Masters')} {c.masterShare === undefined ? '—' : fmtPercent(c.masterShare)}
                    </span>
                    <span title={t('Your side’s score at your rating')}>
                      {t('Club')} {c.practical === undefined ? '—' : fmtPercent(c.practical)}
                    </span>
                    {c.games > 0 && <span>{tn(c.games, '{n} game', '{n} games')}</span>}
                  </div>
                </div>
                <span className="tnum shrink-0 rounded-md bg-surface-3 px-2 py-1 text-sm font-bold" title={t('{eval} after this move', { eval: formatEval(c.line) })} dir="ltr">
                  {c.line ? formatEval(c.line) : searching ? <Spinner size={12} /> : '—'}
                </span>
              </button>
            </li>
          ))}
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

function Header({ title, hint, busy }: { title: string; hint?: string; busy: boolean }) {
  return (
    <header className="px-3 pt-3 pb-2">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        {title}
        {busy && <Spinner size={12} />}
      </h2>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </header>
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
    <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap ${d.tone}`}>
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

const squareIndex = (sq: string) => (sq.charCodeAt(0) - 97) + 8 * (Number(sq[1]) - 1);
