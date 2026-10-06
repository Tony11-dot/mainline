import { Link } from 'react-router';
import { CalendarDays, Eye, Folder as FolderIcon, GitBranch, Target, Waypoints } from 'lucide-react';
import type { WeakItem } from '../../lib/weakness';
import { rate } from '../../lib/weakness';
import { practiceHref, type Scope } from '../../lib/practice';
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

export function severity(it: WeakItem): { label: string; tone: string } {
  if (it.badness >= 1.6) return { label: t('Much weaker than usual'), tone: 'bg-bad-soft text-bad' };
  if (it.badness >= 1.15) return { label: t('Weaker than usual'), tone: 'bg-warn-soft text-[oklch(0.45_0.1_70)] dark:text-warn' };
  if (it.badness <= 0.8) return { label: t('A strength'), tone: 'bg-good-soft text-good' };
  return { label: t('About usual'), tone: 'bg-surface-3 text-ink-2' };
}

const ICON = { move: GitBranch, folder: FolderIcon, line: Waypoints };

export function WeakRow({ it }: { it: WeakItem }) {
  const Icon = ICON[it.kind];
  const sev = severity(it);
  const label = it.kind === 'move' ? it.context : it.label;
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {it.kind === 'move' ? (
              <>
                {t('After')} <bdi dir="ltr">{label}</bdi>
              </>
            ) : (
              label
            )}
          </p>
          {it.kind !== 'move' && it.context && <p className="truncate text-xs text-ink-3">{it.context}</p>}
          <p className="tnum mt-0.5 text-sm text-ink-2">{evidenceText(it)}</p>
          {it.kind === 'move' && <p className="text-xs text-ink-3">{tn(it.positions, 'Covers {n} position you must know after it.', 'Covers the {n} positions you must know after it.')}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${sev.tone}`}>{sev.label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 ps-7">
        <Link to={practiceHref(it.scope, 'show')} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-2.5 text-sm font-semibold hover:bg-surface-2">
          <Eye size={14} aria-hidden /> {t('Show me')}
        </Link>
        <Link to={practiceHref(it.scope, 'test')} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-brand px-2.5 text-sm font-semibold text-on-brand">
          <Target size={14} aria-hidden /> {t('Test me')}
        </Link>
        <Link to={planHref(it.scope, it.kind === 'move' ? `${t('After')} ${label}` : label)} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
          <CalendarDays size={14} aria-hidden /> {t('Make a plan')}
        </Link>
      </div>
    </li>
  );
}
