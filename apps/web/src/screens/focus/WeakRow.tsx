import { Link } from 'react-router';
import { CalendarDays, Eye, Folder as FolderIcon, GitBranch, Target, Waypoints } from 'lucide-react';
import type { WeakItem } from '../../lib/weakness';
import { rate } from '../../lib/weakness';
import { practiceHref, type Scope } from '../../lib/practice';
import { Pill, type Tone } from '../../ui/kit';
import { fmtPercent, t, tn } from '../../lib/i18n';

export const planHref = (scope: Scope, label: string) => `/plan?new=1&scope=${encodeURIComponent(JSON.stringify(scope))}&label=${encodeURIComponent(label)}`;

/** What the numbers say, in a sentence: "You miss 38% of your moves (13 of 34) · you score 30% in 10 games". */
export function evidenceText(it: WeakItem): string {
  const r = rate(it.ev);
  const parts: string[] = [];
  if (it.ev.attempts) parts.push(t('You miss {pct} of your moves ({misses} of {n})', { pct: fmtPercent(r.missRate ?? 0), misses: it.ev.misses, n: it.ev.attempts }));
  if (it.ev.games) parts.push(tn(it.ev.games, 'you score {score} in {n} game', 'you score {score} in {n} games', { score: fmtPercent(r.score ?? 0) }));
  return parts.join(' · ');
}

export function severity(it: WeakItem): { label: string; tone: Tone } {
  if (it.badness >= 1.6) return { label: t('Much weaker than usual'), tone: 'bad' };
  if (it.badness >= 1.15) return { label: t('Weaker than usual'), tone: 'warn' };
  if (it.badness <= 0.8) return { label: t('A strength'), tone: 'good' };
  return { label: t('About usual'), tone: 'neutral' };
}

const ICON = { move: GitBranch, folder: FolderIcon, line: Waypoints };

export function WeakRow({ it }: { it: WeakItem }) {
  const Icon = ICON[it.kind];
  const sev = severity(it);
  const label = it.kind === 'move' ? it.context : t(it.label);
  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-start gap-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-s)] bg-brand-soft text-brand-ink" aria-hidden>
          <Icon size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-md font-semibold">
            {it.kind === 'move' ? (
              <>
                {t('After')} <bdi dir="ltr">{label}</bdi>
              </>
            ) : (
              label
            )}
          </p>
          {it.kind !== 'move' && it.context && <p className="truncate text-sm text-ink-2">{it.context}</p>}
          <p className="tnum mt-0.5 text-sm text-ink-2">{evidenceText(it)}</p>
          {it.kind === 'move' && <p className="text-sm text-ink-2">{tn(it.positions, 'Covers {n} position you must know after it.', 'Covers the {n} positions you must know after it.')}</p>}
        </div>
        <span className="hidden shrink-0 sm:block">
          <Pill tone={sev.tone}>{sev.label}</Pill>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 ps-[3.375rem]">
        <Pill tone={sev.tone} className="sm:hidden">
          {sev.label}
        </Pill>
        <Link to={practiceHref(it.scope, 'show')} className="pressable inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-s)] bg-brand-soft px-3 text-sm font-semibold text-brand-ink hover:bg-brand-soft-2">
          <Eye size={15} aria-hidden /> {t('Show me')}
        </Link>
        <Link to={practiceHref(it.scope, 'test')} className="pressable inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-s)] bg-brand px-3 text-sm font-semibold text-on-brand">
          <Target size={15} aria-hidden /> {t('Test me')}
        </Link>
        <Link to={planHref(it.scope, it.kind === 'move' ? `${t('After')} ${label}` : label)} className="pressable inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-s)] px-3 text-sm font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
          <CalendarDays size={15} aria-hidden /> {t('Make a plan')}
        </Link>
      </div>
    </li>
  );
}
