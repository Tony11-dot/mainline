import { useState, type ReactNode } from 'react';
import { MATURITY, pct, type Maturity, type Record3, type TrainingStats } from '../lib/stats';
import { intlLocale, msg, t, tn } from '../lib/i18n';

/** One number with its label (and an optional qualifier underneath). */
export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-l)] bg-surface px-4 py-3.5 shadow-card">
      <div className="text-sm font-medium text-ink-2">{label}</div>
      <div className="tnum mt-0.5 text-2xl leading-tight font-bold tracking-tight break-words">{value}</div>
      {sub && <div className="tnum mt-0.5 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-3 @max-[16rem]:grid-cols-1 sm:grid-cols-4">{children}</div>
    </div>
  );
}

export function StatSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-[var(--section-gap)] first:mt-0">
      <div className="mb-3 flex items-center gap-2 px-1">
        <h2 className="text-lg font-bold">{title}</h2>
        {action && <div className="ms-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

const fmtDay = (ms: number) => new Date(ms).toLocaleDateString(intlLocale(), { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * Reviews per day: one series (brand), bars rise from the baseline with rounded tops and a 2px gap.
 * Hover or tap a day for its numbers; the correct share is carried in the tooltip, not a second hue.
 */
export function ReviewsChart({ daily }: { daily: TrainingStats['daily'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.reviews));
  const h = hover !== null ? daily[hover] : undefined;
  const total = daily.reduce((n, d) => n + d.reviews, 0);
  return (
    <figure className="rounded-[var(--radius-l)] bg-surface p-5 shadow-card">
      <figcaption className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
        <span className="text-md font-bold">{t('Reviews per day')}</span>
        <span className="tnum ms-auto text-sm text-ink-2" aria-live="polite">
          {h
            ? `${fmtDay(h.day)} · ${tn(h.reviews, '{n} review', '{n} reviews')}${h.reviews ? ` · ${t('{pct} correct', { pct: pct(h.correct / h.reviews) })}` : ''}`
            : tn(daily.length, '{total} in {n} day', '{total} in {n} days', { total })}
        </span>
      </figcaption>
      <div className="relative mt-4 h-32" onPointerLeave={() => setHover(null)}>
        {/* Recessive guides: max and half. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
        <span className="tnum pointer-events-none absolute -top-2 end-0 bg-surface ps-1 text-2xs text-ink-3">{max}</span>
        <div className="absolute inset-0 flex items-end gap-[2px]" role="list" aria-label={t('Reviews per day')}>
          {daily.map((d, i) => (
            <div
              key={d.day}
              role="listitem"
              aria-label={`${fmtDay(d.day)}: ${tn(d.reviews, '{n} review', '{n} reviews')}`}
              className="flex h-full flex-1 cursor-default items-end"
              onPointerEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
            >
              <div
                className={`w-full rounded-t-[4px] transition-[background-color] duration-100 ${d.reviews ? (hover === i ? 'bg-brand-ink' : 'bg-brand') : 'bg-surface-3'}`}
                style={{ height: d.reviews ? `${Math.max(4, (d.reviews / max) * 100)}%` : '2px' }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="tnum mt-2 flex justify-between text-xs text-ink-2">
        <span>{fmtDay(daily[0]!.day)}</span>
        <span>{t('Today')}</span>
      </div>
    </figure>
  );
}

const MATURITY_STYLE: Record<Maturity, { label: string; cls: string; hint: string }> = {
  new: { label: msg('New'), cls: 'bg-surface-3', hint: msg('never trained') },
  learning: { label: msg('Learning'), cls: 'bg-[color-mix(in_oklab,var(--brand)_32%,var(--surface))]', hint: msg('still being learnt') },
  young: { label: msg('Young'), cls: 'bg-[color-mix(in_oklab,var(--brand)_62%,var(--surface))]', hint: msg('remembered < 3 weeks') },
  mature: { label: msg('Mature'), cls: 'bg-brand', hint: msg('remembered ≥ 3 weeks') },
};

/** How well positions are known: one hue, light → dark as memory strengthens. */
export function MaturityBar({ maturity }: { maturity: Record<Maturity, number> }) {
  const total = MATURITY.reduce((n, k) => n + maturity[k], 0);
  if (!total) return null;
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={MATURITY.map((k) => `${t(MATURITY_STYLE[k].label)} ${maturity[k]}`).join(', ')}>
        {MATURITY.map((k) =>
          maturity[k] ? <div key={k} className={MATURITY_STYLE[k].cls} style={{ width: `${(maturity[k] / total) * 100}%` }} title={`${t(MATURITY_STYLE[k].label)}: ${maturity[k]} (${t(MATURITY_STYLE[k].hint)})`} /> : null,
        )}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        {MATURITY.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-[3px] ${MATURITY_STYLE[k].cls} ${k === 'new' ? 'ring-1 ring-line-strong' : ''}`} aria-hidden />
            {t(MATURITY_STYLE[k].label)} <span className="tnum font-semibold text-ink">{maturity[k]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Wins / draws / losses as a split bar with the counts spelled out beside it. */
export function RecordBar({ rec, showScore = true }: { rec: Record3; showScore?: boolean }) {
  if (!rec.games) return <span className="text-sm text-ink-2">{t('No games')}</span>;
  const seg = (n: number, cls: string, label: string) => (n ? <div className={cls} style={{ width: `${(n / rec.games) * 100}%` }} title={`${label}: ${n}`} /> : null);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-2.5 min-w-12 flex-1 gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={t('{win} wins, {draw} draws, {loss} losses', { win: rec.win, draw: rec.draw, loss: rec.loss })}>
        {seg(rec.win, 'bg-good', t('Wins'))}
        {seg(rec.draw, 'bg-ink-3/50', t('Draws'))}
        {seg(rec.loss, 'bg-bad', t('Losses'))}
      </div>
      <span className="tnum shrink-0 text-sm text-ink-2">
        <span className="font-semibold text-ink">+{rec.win}</span> ={rec.draw} −{rec.loss}
        {showScore && <span className="ms-1.5 font-semibold text-ink">{pct(rec.score)}</span>}
      </span>
    </div>
  );
}

export function FormDots({ form }: { form: ('win' | 'draw' | 'loss')[] }) {
  // One-letter result marks, as on chess sites: translators pick the letter (e.g. G/U/P).
  const style = { win: ['bg-good text-white', t('W')], draw: ['bg-surface-3 text-ink-2', t('D')], loss: ['bg-bad text-white', t('L')] } as const;
  return (
    <ol className="flex gap-1" aria-label={tn(form.length, 'Last {n} result, newest first', 'Last {n} results, newest first')}>
      {form.map((r, i) => (
        <li key={i} className={`grid size-7 place-items-center rounded-full text-xs font-bold ${style[r][0]}`}>
          {style[r][1]}
        </li>
      ))}
    </ol>
  );
}
