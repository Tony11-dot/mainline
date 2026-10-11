// The guide's pictures: small, inert copies of the real screens, drawn with the app's own kit and sample data.
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Cloud,
  Download,
  Dumbbell,
  Eye,
  Flame,
  Folder as FolderIcon,
  FolderInput,
  Gauge,
  GraduationCap,
  Bell,
  Palette,
  Pencil,
  Play,
  RotateCcw,
  Shuffle,
  Snowflake,
  Sparkles,
  Swords,
  Target,
  Trash2,
} from 'lucide-react';
import { MAX_FREEZES } from '@mainline/shared';
import { NAV } from '../../ui/nav';
import { MiniBoard } from '../../ui/MiniBoard';
import { LogoMark } from '../../ui/Logo';
import { IconTile, Pill } from '../../ui/kit';
import { fmtPercent, t, tn } from '../../lib/i18n';

const ITALIAN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
const GIUOCO = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
const TWO_KNIGHTS = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

/** A copy of a surface: the card look, never focusable, hidden from screen readers (the text beside it says the same). */
function Mock({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none select-none ${className}`}>
      {children}
    </div>
  );
}

const card = 'rounded-[var(--radius-l)] bg-surface shadow-card';

export function LoopArt() {
  const steps = [
    { icon: BookOpen, label: t('Build'), tone: 'brand' as const },
    { icon: GraduationCap, label: t('Train'), tone: 'good' as const },
    { icon: Swords, label: t('Check'), tone: 'flame' as const },
  ];
  return (
    <Mock className="flex flex-col items-center gap-7">
      <LogoMark size={56} />
      <div className="flex items-start justify-center gap-2 sm:gap-4">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-start gap-2 sm:gap-4">
            {i > 0 && <ArrowRight size={18} className="mt-4 shrink-0 text-ink-3 rtl:rotate-180" />}
            <div className="flex w-[76px] flex-col items-center gap-2 text-center sm:w-[92px]">
              <IconTile icon={s.icon} tone={s.tone} size="lg" />
              <span className="text-sm font-bold break-words hyphens-auto">{s.label}</span>
            </div>
          </div>
        ))}
      </div>
    </Mock>
  );
}

export function NavArt() {
  return (
    // As wide as the stage allows (the real bar spans the screen), so the five labels fit as they do in the app.
    <Mock className="-mx-2 flex w-[calc(100%+16px)] max-w-[440px] gap-[6px]">
      <div className="glass flex h-[60px] min-w-0 flex-1 items-stretch justify-around rounded-[24px] px-[2px]">
        {NAV.map(({ to, label, icon: Icon }, i) => (
          // Each tab takes the width its label needs (German "Einstellungen" is long, "Heute" short), as the five share the bar.
          <span key={to} className={`flex flex-auto flex-col items-center justify-center gap-[4px] px-[2px] text-[10px] font-semibold ${i === 0 ? 'text-brand' : 'text-ink-3'}`}>
            <Icon size={21} strokeWidth={2} />
            <span className="whitespace-nowrap">{t(label)}</span>
          </span>
        ))}
      </div>
      <span className="glass flex size-[60px] shrink-0 items-center justify-center rounded-full text-brand">
        <Sparkles size={22} strokeWidth={2} />
      </span>
    </Mock>
  );
}

function Ring({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 38 38" width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx="19" cy="19" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="4.5" />
      <circle cx="19" cy="19" r={r} fill="none" stroke={pct >= 1 ? 'var(--good)' : 'var(--brand)'} strokeWidth="4.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
    </svg>
  );
}

export function TodayArt() {
  return (
    <Mock className="flex w-full max-w-[380px] flex-col gap-3">
      <div className="flex items-center gap-4 rounded-[var(--radius-l)] bg-brand p-5 text-on-brand shadow-3">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--on-brand)_18%,transparent)]">
          <Play size={26} fill="currentColor" />
        </span>
        <span className="min-w-0">
          <span className="block text-2xl font-bold tracking-tight">{t('Train now')}</span>
          <span className="tnum block text-md opacity-85">{t('{due} due · ~{min} min', { due: 12, min: 6 })}</span>
        </span>
      </div>
      <div className={`${card} tnum flex items-stretch`}>
        <div className="flex min-w-0 flex-[1.3] items-center gap-3 py-4 ps-4 pe-2">
          <Ring pct={14 / 20} size={40} />
          <div className="min-w-0">
            <div className="text-xs leading-tight font-medium break-words text-ink-2">{t('Daily goal')}</div>
            <div className="text-xl font-bold leading-tight">
              14<span className="text-base font-semibold text-ink-3">/20</span>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1 border-s border-line px-4 py-4">
          <div className="text-xs leading-tight font-medium break-words text-ink-2">{t('Learned')}</div>
          <div className="text-xl font-bold leading-tight">
            34<span className="text-base font-semibold text-ink-3">/60</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 border-s border-line px-4 py-4">
          <div className="text-xs leading-tight font-medium break-words text-ink-2">{t('Retention')}</div>
          <div className="text-xl font-bold leading-tight">{fmtPercent(0.92)}</div>
        </div>
      </div>
    </Mock>
  );
}

function Crumbs({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 px-1 text-sm font-semibold text-ink-2">
      {items.map((it, i) => (
        <span key={it} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={14} className="text-ink-3 rtl:rotate-180" />}
          <span className={i === items.length - 1 ? 'text-ink' : ''}>{it}</span>
        </span>
      ))}
    </div>
  );
}

function LineRow({ fen, name, sub }: { fen: string; name: string; sub: string }) {
  return (
    <div className="flex min-h-[64px] items-center gap-3.5 px-4 py-2.5">
      <MiniBoard fen={fen} size={48} className="rounded-[6px]" decorative />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-md font-semibold">{name}</span>
        <span className="block text-sm text-ink-2">{sub}</span>
      </span>
    </div>
  );
}

export function RepertoireArt() {
  return (
    <Mock className="flex w-full max-w-[380px] flex-col gap-3">
      <Crumbs items={[t('As White'), '1.e4 e5', t('Italian Game')]} />
      <div className={`${card} divide-y divide-line overflow-hidden`}>
        <div className="flex min-h-[64px] items-center gap-3.5 px-4 py-2.5">
          <FolderIcon size={22} className="shrink-0 text-brand" fillOpacity={0.15} />
          <span className="min-w-0 flex-1">
            <span className="block text-md font-semibold">{t('Italian Game')}</span>
            <span className="block text-sm text-ink-2">{tn(3, '{n} line', '{n} lines')}</span>
          </span>
          <ChevronRight size={20} className="text-ink-3 rtl:rotate-180" />
        </div>
        <LineRow fen={GIUOCO} name="Giuoco Piano (3…Bc5)" sub="1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5" />
        <LineRow fen={TWO_KNIGHTS} name="Two Knights (3…Nf6)" sub="1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6" />
      </div>
    </Mock>
  );
}

export function OrganiseArt() {
  const items = [
    { icon: Eye, label: t('Show me') },
    { icon: Target, label: t('Test me') },
    { icon: Pencil, label: t('Rename') },
    { icon: FolderInput, label: t('Move to…') },
    { icon: Download, label: t('Export PGN') },
  ];
  return (
    <Mock className="relative flex w-full max-w-[380px] flex-col">
      <div className={`${card} overflow-hidden`}>
        <div className="bg-brand-softer">
          <LineRow fen={GIUOCO} name="Giuoco Piano (3…Bc5)" sub="1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5" />
        </div>
      </div>
      <div className="-mt-2 ms-auto me-3 w-[min(230px,85%)] rounded-[var(--radius-m)] bg-surface p-1.5 shadow-3 ring-1 ring-line">
        {items.map(({ icon: Icon, label }) => (
          <div key={label} className="flex min-h-10 items-center gap-3 rounded-[var(--radius-s)] px-3 text-base">
            <Icon size={17} className="shrink-0 text-ink-2" />
            <span className="min-w-0 break-words">{label}</span>
          </div>
        ))}
        <div className="my-1 border-t border-line" />
        <div className="flex min-h-10 items-center gap-3 rounded-[var(--radius-s)] px-3 text-base text-bad-ink">
          <Trash2 size={17} className="shrink-0" />
          {t('Delete')}
        </div>
      </div>
    </Mock>
  );
}

/** A board with one arrow on it, the way the guided builder marks its top pick. */
function ArrowBoard({ fen, from, to, size }: { fen: string; from: string; to: string; size: number }) {
  const c = (sq: string) => ({ x: (sq.charCodeAt(0) - 97) * 12.5 + 6.25, y: (8 - Number(sq[1])) * 12.5 + 6.25 });
  const a = c(from);
  const b = c(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const end = { x: b.x - ((b.x - a.x) / len) * 3.2, y: b.y - ((b.y - a.y) / len) * 3.2 };
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <MiniBoard fen={fen} size={size} decorative />
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        <defs>
          <marker id="guide-arrow" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--brand)" />
          </marker>
        </defs>
        <line x1={a.x} y1={a.y} x2={end.x} y2={end.y} stroke="var(--brand)" strokeWidth="2.6" strokeLinecap="round" opacity="0.85" markerEnd="url(#guide-arrow)" />
      </svg>
    </div>
  );
}

export function BuildArt() {
  const rows = [
    { san: 'Bb5', tags: [t('By the book'), t('Engine’s pick')], pct: 0.48 },
    { san: 'Bc4', tags: [t('Crowd favourite')], pct: 0.31 },
  ];
  return (
    <Mock className="flex w-full max-w-[400px] flex-col items-center gap-3 sm:flex-row sm:items-start">
      <ArrowBoard fen={ITALIAN} from="f1" to="b5" size={168} />
      <div className={`${card} w-full min-w-0 flex-1 divide-y divide-line overflow-hidden`}>
        {rows.map((r, i) => (
          <div key={r.san} className={`flex flex-col gap-1.5 px-4 py-3 ${i === 0 ? 'bg-brand-softer' : ''}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-bold">{r.san}</span>
              <span className="tnum text-sm text-ink-2">{fmtPercent(r.pct)}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {r.tags.map((tag) => (
                <Pill key={tag} tone={i === 0 ? 'brand' : 'neutral'}>
                  {tag}
                </Pill>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Mock>
  );
}

export function PanelsArt() {
  const tabs = [t('Moves'), t('Explorer'), t('Engine'), t('Stats'), t('Coach'), t('Suggest'), t('Notes'), t('Coverage')];
  return (
    <Mock className="flex w-full max-w-[400px] flex-col items-center gap-4">
      <MiniBoard fen={GIUOCO} size={140} decorative />
      <div className="flex flex-wrap justify-center gap-1.5">
        {tabs.map((tab, i) => (
          <span key={tab} className={`inline-flex min-h-9 items-center rounded-full px-3.5 py-1 text-sm font-semibold ${i === 1 ? 'bg-brand text-on-brand' : 'bg-surface text-ink-2 shadow-card'}`}>
            {tab}
          </span>
        ))}
      </div>
    </Mock>
  );
}

export function ModesArt() {
  const modes = [
    { icon: GraduationCap, label: t('Learn') },
    { icon: RotateCcw, label: t('Review') },
    { icon: Shuffle, label: t('Drill') },
    { icon: Dumbbell, label: t('Position quiz') },
  ];
  return (
    <Mock className="flex w-full max-w-[380px] flex-col items-center gap-5">
      <div className="grid w-full grid-cols-2 gap-2.5">
        {modes.map(({ icon, label }) => (
          <div key={label} className={`${card} flex min-w-0 items-center gap-3 p-3.5`}>
            <IconTile icon={icon} size="sm" />
            <span className="min-w-0 text-base font-semibold break-words hyphens-auto">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <span className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] bg-brand-soft px-4 font-semibold text-brand-ink">
          <Eye size={17} /> {t('Show me')}
        </span>
        <span className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] bg-brand px-4 font-semibold text-on-brand">
          <Target size={17} /> {t('Test me')}
        </span>
      </div>
    </Mock>
  );
}

export function HabitArt() {
  const week = [true, true, true, false, true, true, true];
  return (
    <Mock className="flex w-full max-w-[360px] flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <span className="flex size-16 items-center justify-center rounded-full bg-flame-soft text-flame">
          <Flame size={34} fill="currentColor" />
        </span>
        <span className="text-3xl font-bold tracking-tight text-flame-ink">{tn(12, '{n}-day streak', '{n}-day streak')}</span>
      </div>
      <div className="flex gap-1.5">
        {week.map((on, i) => (
          <span key={i} className={`flex size-9 items-center justify-center rounded-full ${on ? 'bg-flame text-white' : 'bg-freeze-soft text-freeze'}`}>
            {on ? <Check size={16} strokeWidth={3} /> : <Snowflake size={16} />}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Pill tone="freeze" icon={Snowflake} size="md">
          {t('{n} of {max} streak freezes', { n: 1, max: MAX_FREEZES })}
        </Pill>
        <Pill tone="good" size="md">
          🎯 {t('Daily goal complete')}
        </Pill>
      </div>
    </Mock>
  );
}

export function GamesArt() {
  const games = [
    { result: t('Won'), tone: 'good' as const, kind: t('Prep ended'), kindTone: 'good' as const, move: 9 },
    { result: t('Lost'), tone: 'bad' as const, kind: t('Forgotten'), kindTone: 'bad' as const, move: 5 },
    { result: t('Draw'), tone: 'neutral' as const, kind: t('Surprises'), kindTone: 'warn' as const, move: 3 },
  ];
  return (
    <Mock className="w-full max-w-[380px]">
      <div className={`${card} divide-y divide-line overflow-hidden`}>
        {games.map((g) => (
          <div key={g.kind} className="flex min-h-[60px] flex-wrap items-center gap-2 px-4 py-2.5">
            <Pill tone={g.tone}>{g.result}</Pill>
            <span className="min-w-0 flex-1 text-base font-semibold">{t('move {n}', { n: g.move })}</span>
            <Pill tone={g.kindTone} size="md">
              {g.kind}
            </Pill>
          </div>
        ))}
      </div>
    </Mock>
  );
}

export function WeakArt() {
  return (
    <Mock className="flex w-full max-w-[380px] flex-col gap-3">
      <div className={`${card} flex items-center gap-3.5 p-4`}>
        <MiniBoard fen="rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2" size={52} className="rounded-[6px]" decorative />
        <span className="min-w-0 flex-1">
          <span className="block text-md font-semibold">
            {t('After')} 1.e4 c5
          </span>
          <span className="block text-sm text-bad-ink">{t('You miss {pct} of your moves ({misses} of {n})', { pct: fmtPercent(0.38), misses: 5, n: 13 })}</span>
        </span>
      </div>
      <div className={`${card} p-4`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-md font-bold">{t('Study plan')}</span>
          <span className="text-sm font-semibold text-ink-2">{t('Day {day} of {days}', { day: 2, days: 5 })}</span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {[1, 1, 0.5, 0, 0].map((v, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${v === 1 ? 'bg-brand' : v ? 'bg-brand-soft-2' : 'bg-surface-3'}`} />
          ))}
        </div>
      </div>
    </Mock>
  );
}

export function ExploreArt() {
  const rows = [
    { san: 'e4', share: 0.46, w: 0.39, d: 0.27 },
    { san: 'd4', share: 0.36, w: 0.4, d: 0.3 },
    { san: 'Nf3', share: 0.1, w: 0.37, d: 0.33 },
  ];
  return (
    <Mock className="flex w-full max-w-[400px] flex-col items-center gap-3 sm:flex-row sm:items-start">
      <MiniBoard fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" size={150} decorative />
      <div className={`${card} w-full min-w-0 flex-1 divide-y divide-line overflow-hidden`}>
        {rows.map((r) => (
          <div key={r.san} className="flex items-center gap-3 px-4 py-3">
            <span className="w-9 text-base font-bold">{r.san}</span>
            <span className="tnum w-10 text-sm text-ink-2">{fmtPercent(r.share)}</span>
            <span className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-[4px] ring-1 ring-line">
              <span style={{ width: `${r.w * 100}%`, background: 'var(--chess-white)' }} />
              <span style={{ width: `${r.d * 100}%`, background: 'var(--chess-draw)' }} />
              <span className="flex-1" style={{ background: 'var(--chess-black)' }} />
            </span>
          </div>
        ))}
      </div>
    </Mock>
  );
}

export function AiArt() {
  return (
    <Mock className="flex w-full max-w-[360px] flex-col gap-2.5">
      <p className="ms-auto max-w-[85%] rounded-[var(--radius-m)] rounded-ee-[6px] bg-brand px-4 py-2.5 text-base text-on-brand">{t('Why do I play Bc4 here?')}</p>
      <div className="flex max-w-[92%] gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
          <Sparkles size={16} />
        </span>
        <p className="rounded-[var(--radius-m)] rounded-ss-[6px] bg-surface px-4 py-2.5 text-base shadow-card">{t('Bc4 aims at f7, the weakest square near Black’s king, and gets you ready to castle.')}</p>
      </div>
    </Mock>
  );
}

export function SettingsArt() {
  const rows = [
    { icon: Gauge, label: t('Your level') },
    { icon: Palette, label: t('Board & motion') },
    { icon: Bell, label: t('Reminders') },
    { icon: Cloud, label: t('Account') },
  ];
  return (
    <Mock className="grid w-full max-w-[360px] grid-cols-2 gap-2.5">
      {rows.map(({ icon, label }) => (
        <div key={label} className={`${card} flex min-w-0 flex-col items-start gap-3 p-4`}>
          <IconTile icon={icon} />
          <span className="min-w-0 text-base font-semibold break-words hyphens-auto">{label}</span>
        </div>
      ))}
    </Mock>
  );
}

export function ReadyArt() {
  return (
    <Mock className="flex flex-col items-center gap-5">
      <LogoMark size={64} />
      <span className="flex size-20 items-center justify-center rounded-full bg-good-soft text-good">
        <Check size={44} strokeWidth={2.6} />
      </span>
    </Mock>
  );
}
