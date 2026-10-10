import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays, GraduationCap, Swords } from 'lucide-react';
import type { Color } from '@mainline/shared';
import { useWeakness } from '../lib/useWeakness';
import { notLearned, rate, type WeakItem } from '../lib/weakness';
import { practiceHref } from '../lib/practice';
import { usePlan } from '../lib/plan';
import { Segmented } from '../ui/primitives';
import { EmptyState, IconTile, PageHeader, SectionHeader } from '../ui/kit';
import { WeakRow, planHref } from './focus/WeakRow';
import { fmtPercent, t, tn } from '../lib/i18n';

type Side = 'all' | Color;

/**
 * Where you're weakest — by move, by opening and by line — from your training answers and your games, with a
 * one-tap way to practise each or to plan the next days around it.
 */
export function FocusScreen() {
  const { report, loaded } = useWeakness();
  const plan = usePlan((s) => s.plan);
  const [side, setSide] = useState<Side>('all');
  const pick = (items: WeakItem[]) => items.filter((x) => (side === 'all' || x.color === side) && x.badness >= 1.15).slice(0, 5);
  const moves = useMemo(() => (report ? pick(report.moves) : []), [report, side]); // eslint-disable-line react-hooks/exhaustive-deps
  const folders = useMemo(() => (report ? pick(report.folders) : []), [report, side]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines = useMemo(() => (report ? pick(report.lines) : []), [report, side]); // eslint-disable-line react-hooks/exhaustive-deps
  const gaps = useMemo(() => (report ? notLearned(report.folders.length ? [...report.folders] : report.lines).filter((x) => side === 'all' || x.color === side).slice(0, 3) : []), [report, side]);
  const top = [...moves, ...folders, ...lines].sort((a, b) => b.badness - a.badness)[0];
  const nothing = loaded && report && !moves.length && !folders.length && !lines.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title={t('Weak spots')} back="/library" large />
      <p className="mt-2 max-w-[60ch] text-md text-ink-2">{t('Where you go wrong most — by move, by opening and by line — from your training answers (last 90 days) and your imported games.')}</p>

      {report && (
        <dl className="tnum mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(['white', 'black'] as Color[]).map((c) => {
            const b = report.byColor[c];
            const r = rate(b.ev);
            return (
              <div key={c} className="rounded-[var(--radius-l)] bg-surface p-5 shadow-card">
                <dt className="text-md font-bold">{c === 'white' ? t('As White') : t('As Black')}</dt>
                <dd className="mt-1.5 text-base">
                  <span className="block font-semibold">{b.ev.attempts ? t('{pct} of your moves right', { pct: fmtPercent(1 - (r.missRate ?? 0)) }) : t('No answers yet')}</span>
                  <span className="block text-ink-2">{b.ev.games ? tn(b.ev.games, 'Score {score} in {n} game in your lines', 'Score {score} in {n} games in your lines', { score: fmtPercent(r.score ?? 0) }) : t('No games in your lines yet')}</span>
                  <span className="block text-ink-2">{t('{learned} of {total} positions learned', { learned: b.learned, total: b.positions })}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented<Side>
          label={t('Side')}
          value={side}
          onChange={setSide}
          options={[
            { value: 'all', label: <span className="whitespace-nowrap px-1">{t('Both')}</span> },
            { value: 'white', label: <span className="whitespace-nowrap px-1">{t('As White')}</span> },
            { value: 'black', label: <span className="whitespace-nowrap px-1">{t('As Black')}</span> },
          ]}
        />
        {top && (
          <Link to={planHref(top.scope, top.kind === 'move' ? `${t('After')} ${top.context}` : t(top.label))} className="pressable inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-brand px-4 py-2 font-semibold text-on-brand">
            <CalendarDays size={17} className="shrink-0" aria-hidden /> {plan ? t('Plan for my weakest spot') : t('Make a plan for my weakest spot')}
          </Link>
        )}
      </div>

      {nothing && (
        <EmptyState
          className="mt-6"
          icon={Swords}
          title={t('Nothing stands out yet')}
          action={
            <Link to="/games" className="pressable inline-flex h-11 items-center rounded-[var(--radius-control)] bg-brand-soft px-4 font-semibold text-brand-ink hover:bg-brand-soft-2">
              {t('Import games')}
            </Link>
          }
        >
          {t('MainLine needs a few sessions of answers or some imported games before it can spot a pattern. Test yourself a few times, or import your games.')}
        </EmptyState>
      )}

      <Section title={t('Moves that lead to trouble')} hint={t('Everything after the move counts: if the lines that answer it go badly, the move shows here.')} items={moves} />
      <Section title={t('Weakest openings')} items={folders} />
      <Section title={t('Weakest lines')} items={lines} />

      {gaps.length > 0 && (
        <section className="mt-[var(--section-gap)]">
          <SectionHeader title={t('Not learned yet')} />
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] bg-surface shadow-card">
            {gaps.map((g) => (
              <li key={g.key} className="flex min-h-[64px] items-center gap-3.5 px-5 py-3">
                <IconTile icon={GraduationCap} />
                <span className="min-w-0 flex-1">
                  <span className="block text-md font-semibold">{t(g.label)}</span>
                  <span className="tnum block text-sm text-ink-2">{t('{learned} of {total} positions learned', { learned: g.learned, total: g.positions })}</span>
                </span>
                <Link to={practiceHref(g.scope, 'learn')} className="pressable inline-flex h-10 items-center rounded-[var(--radius-s)] bg-brand px-4 text-sm font-semibold text-on-brand">
                  {t('Learn')}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Section({ title, hint, items }: { title: string; hint?: string; items: WeakItem[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-[var(--section-gap)]">
      <SectionHeader title={title} hint={hint} />
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] bg-surface shadow-card">
        {items.map((it) => (
          <WeakRow key={`${it.kind}${it.key}`} it={it} />
        ))}
      </ul>
    </section>
  );
}
