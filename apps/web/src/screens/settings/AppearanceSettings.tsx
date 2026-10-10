import { CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  BOARD_THEMES,
  DARK_FAMILY,
  FONTS,
  LIGHT_FAMILY,
  MAINLINE_DARK,
  MAINLINE_LIGHT,
  PIECE_SETS,
  THEME_TOKENS,
  themeName,
  type BoardTheme,
  type ThemeId,
  type ThemeTokens,
} from '../../lib/appearance';
import { usePrefs } from '../../lib/prefs';
import { t } from '../../lib/i18n';
import { ListGroup, Section } from '../../ui/kit';

/**
 * Theme / font / board / pieces pickers — the same layout as ClassMate & ClassMusic Settings:
 * "Light themes" (System default first) and "Dark themes" as swatch rows with a checkmark, then the
 * font pack as "Aa" rows. Board and piece sets follow, so the whole board can match the theme.
 */
export function AppearanceSettings() {
  return (
    <>
      <Picker title={t('Light themes')}>
        {(['system', ...LIGHT_FAMILY] as ThemeId[]).map((id) => (
          <ThemeRow key={id} id={id} />
        ))}
      </Picker>
      <Picker title={t('Dark themes')}>
        {DARK_FAMILY.map((id) => (
          <ThemeRow key={id} id={id} />
        ))}
      </Picker>
      <Picker title={t('Font')}>
        {FONTS.map((f) => (
          <FontRow key={f.id} id={f.id} name={f.name} stack={f.stack} load={f.load} />
        ))}
      </Picker>
      <Picker title={t('Board')}>
        <BoardPicker />
      </Picker>
      <Picker title={t('Pieces')}>
        <PiecePicker />
      </Picker>
    </>
  );
}

function Picker({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section title={title}>
      <ListGroup>{children}</ListGroup>
    </Section>
  );
}

function Check({ on }: { on: boolean }) {
  return on ? <CheckCircle2 size={22} className="shrink-0 fill-brand text-surface" aria-hidden /> : <span className="size-[22px] shrink-0" />;
}

function ThemeRow({ id }: { id: ThemeId }) {
  const { appTheme, set } = usePrefs();
  const tokens = id === 'system' ? MAINLINE_LIGHT : THEME_TOKENS[id];
  const on = appTheme === id;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => set({ appTheme: id })}
      className="pressable flex min-h-[64px] w-full items-center gap-4 px-5 py-2.5 text-start hover:bg-surface-2 active:bg-surface-3"
    >
      <ThemeSwatch tokens={tokens} system={id === 'system'} />
      <span className="flex-1 text-md font-medium text-ink">{themeName(id)}</span>
      <Check on={on} />
    </button>
  );
}

/** ClassMate's swatch: a surface card with an accent dot, two "text" bars and a paper chip. */
function ThemeSwatch({ tokens: t, system }: { tokens: ThemeTokens; system?: boolean }) {
  return (
    <span
      aria-hidden
      className="relative flex h-11 w-[108px] shrink-0 items-center gap-1.5 overflow-hidden rounded-[var(--radius-s)] px-2"
      style={{ background: system ? `linear-gradient(135deg, ${t.surface} 50%, ${MAINLINE_DARK.surface} 50%)` : t.surface, boxShadow: `inset 0 0 0 0.5px ${t.separator}` }}
    >
      <span className="size-4 shrink-0 rounded-full" style={{ background: t.accent }} />
      <span className="flex flex-col gap-[3px]">
        <span className="h-[3px] w-[34px] rounded-full" style={{ background: t.ink }} />
        <span className="h-[3px] w-6 rounded-full" style={{ background: t.inkSecondary }} />
      </span>
      <span className="ms-auto h-6 w-[18px] shrink-0 rounded-[4px]" style={{ background: t.paper, boxShadow: `inset 0 0 0 0.5px ${t.separator}` }} />
    </span>
  );
}

function FontRow({ id, name, stack, load }: { id: (typeof FONTS)[number]['id']; name: string; stack: string; load?: () => Promise<unknown> }) {
  const { font, set } = usePrefs();
  const on = font === id;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onPointerEnter={() => void load?.()}
      onFocus={() => void load?.()}
      onClick={() => set({ font: id })}
      className="pressable flex min-h-[56px] w-full items-center gap-4 px-5 py-2 text-start hover:bg-surface-2 active:bg-surface-3"
    >
      <span className="w-10 text-center text-xl text-ink" style={{ fontFamily: stack }} aria-hidden>
        Aa
      </span>
      <span className="flex-1 text-md font-medium text-ink" style={{ fontFamily: stack }}>
        {t(name)}
      </span>
      <Check on={on} />
    </button>
  );
}

const BOARD_PREVIEW: Record<Exclude<BoardTheme, 'match'>, [string, string]> = {
  blue: ['oklch(0.93 0.018 250)', 'oklch(0.66 0.055 250)'],
  slate: ['oklch(0.9 0.006 262)', 'oklch(0.6 0.02 262)'],
  brown: ['#f0d9b5', '#b58863'],
  green: ['#eeeed2', '#769656'],
};

function BoardPicker() {
  const { boardTheme, set } = usePrefs();
  return (
    <div className="flex flex-wrap gap-4 p-5" role="radiogroup" aria-label={t('Board')}>
      {BOARD_THEMES.map((b) => {
        const [light, dark] =
          b.id === 'match' ? ['color-mix(in oklab, var(--brand) 9%, #f3f5f8)', 'color-mix(in oklab, var(--brand) 34%, #9ea6b3)'] : BOARD_PREVIEW[b.id];
        const on = boardTheme === b.id;
        return (
          <button key={b.id} type="button" role="radio" aria-checked={on} onClick={() => set({ boardTheme: b.id })} className="flex flex-col items-center gap-1.5">
            <span
              className={`size-14 rounded-[var(--radius-s)] transition-shadow ${on ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface' : 'ring-1 ring-line'}`}
              style={{ backgroundImage: `repeating-conic-gradient(${dark} 0 25%, ${light} 0 50%)`, backgroundSize: '50% 50%' }}
            />
            <span className={`text-xs font-semibold ${on ? 'text-ink' : 'text-ink-2'}`}>{t(b.name)}</span>
          </button>
        );
      })}
    </div>
  );
}

function PiecePicker() {
  const { pieceSet, set } = usePrefs();
  return (
    <div className="grid grid-cols-4 gap-2 p-4 sm:grid-cols-8" role="radiogroup" aria-label={t('Pieces')}>
      {PIECE_SETS.map((p) => {
        const on = pieceSet === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={t(p.name)}
            onClick={() => set({ pieceSet: p.id })}
            className={`pressable flex flex-col items-center gap-1 rounded-[var(--radius-control)] p-1.5 ${on ? 'bg-brand-soft ring-2 ring-brand' : 'hover:bg-surface-2'}`}
          >
            <span className="flex">
              <img src={`/pieces/${p.id}/wN.svg`} alt="" className="size-8" loading="lazy" />
              <img src={`/pieces/${p.id}/bQ.svg`} alt="" className="-ms-2 size-8" loading="lazy" />
            </span>
            <span className={`text-2xs font-semibold ${on ? 'text-ink' : 'text-ink-2'}`}>{t(p.name)}</span>
          </button>
        );
      })}
    </div>
  );
}
