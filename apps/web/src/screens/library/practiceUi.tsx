import { Link } from 'react-router';
import { Eye, Target } from 'lucide-react';
import { isOwnTurn, type RepMove, type Repertoire, type TrainCard } from '@mainline/shared';
import { practiceHref, type Scope } from '../../lib/practice';
import type { OpeningRecord } from '../../lib/packs';
import { Pill } from '../../ui/kit';
import { fmtPercent, t, tn } from '../../lib/i18n';

/** "Show me" (every move shown, tonal) and "Test me" (from memory, filled) for any part of the library. */
export function PracticeButtons({ scope, disabled, size = 'md' }: { scope: Scope; disabled?: boolean; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-9 gap-1.5 rounded-[var(--radius-s)] px-3.5 text-sm' : 'h-11 gap-2 rounded-[var(--radius-control)] px-4';
  const off = disabled ? 'pointer-events-none opacity-45' : '';
  return (
    <div className="flex flex-wrap gap-2">
      <Link to={practiceHref(scope, 'show')} aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} className={`pressable inline-flex items-center bg-brand-soft font-semibold text-brand-ink hover:bg-brand-soft-2 ${cls} ${off}`}>
        <Eye size={size === 'sm' ? 15 : 17} aria-hidden /> {t('Show me')}
      </Link>
      <Link to={practiceHref(scope, 'test')} aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} className={`pressable inline-flex items-center bg-brand font-semibold text-on-brand hover:brightness-110 ${cls} ${off}`}>
        <Target size={size === 'sm' ? 15 : 17} aria-hidden /> {t('Test me')}
      </Link>
    </div>
  );
}

export interface ScopeProgress {
  lines: number;
  positions: number;
  learned: number;
}

/** How many lines and positions a set of repertoires holds, and how many of those positions you've learned. */
export function scopeProgress(reps: Repertoire[], moves: RepMove[], cards: TrainCard[]): ScopeProgress {
  const ids = new Map(reps.map((r) => [r.id, r]));
  const own = new Set<string>();
  for (const m of moves) {
    const r = ids.get(m.repertoireId);
    if (r && !m.deleted && m.isMainline && isOwnTurn(r.color, m.fromEpd)) own.add(`${r.color}|${m.fromEpd}`);
  }
  const known = new Set(cards.filter((c) => !c.deleted && c.kind === 'repertoire').map((c) => `${c.color}|${c.epd}`));
  let learned = 0;
  for (const k of own) if (known.has(k)) learned++;
  return { lines: reps.length, positions: own.size, learned };
}

export function ProgressText({ p }: { p: ScopeProgress }) {
  if (!p.lines) return <>{t('No lines yet')}</>;
  return (
    <>
      {tn(p.lines, '{n} line', '{n} lines')}
      {p.positions > 0 && ` · ${t('{pct} learned', { pct: fmtPercent(p.learned / p.positions) })}`}
    </>
  );
}

/** "You: 31% in 26 games", coloured by how it's going. */
export function RecordBadge({ rec }: { rec?: OpeningRecord }) {
  if (!rec) return null;
  const tone = rec.games < 5 ? 'neutral' : rec.score < 0.45 ? 'bad' : rec.score >= 0.55 ? 'good' : 'neutral';
  return (
    <Pill tone={tone} className="tnum">
      {tn(rec.games, 'You: {score} in {n} game', 'You: {score} in {n} games', { score: fmtPercent(rec.score) })}
    </Pill>
  );
}
