/**
 * Themes and fonts — the same collection as ClassMate / ClassNotes / ClassMusic (`ThemePreset`,
 * `FontLibrary`): the same 19 named themes plus "System default", the same curated font pack, same
 * names, same order. "System default" is MainLine's own blue-and-white look, following the OS
 * light/dark setting.
 *
 * A theme is 7 tokens (accent, surface, surfaceRaised, paper, ink, inkSecondary, separator) mapped
 * onto the app's CSS variables. The board ("Match theme") and the launch animation are derived from
 * the same tokens, so everything follows the chosen theme.
 */

export type ThemeId =
  | 'system'
  | 'light'
  | 'coffee'
  | 'matcha'
  | 'rose'
  | 'sand'
  | 'sky'
  | 'lavender'
  | 'peach'
  | 'mint'
  | 'dark'
  | 'midnight'
  | 'nord'
  | 'forest'
  | 'dracula'
  | 'obsidian'
  | 'wine'
  | 'solarized'
  | 'plum'
  | 'ocean';

export interface ThemeTokens {
  accent: string;
  surface: string;
  surfaceRaised: string;
  paper: string;
  ink: string;
  inkSecondary: string;
  separator: string;
}

export const BRAND_BLUE = '#072EB8';

/** MainLine's own look (used by "System default"). */
export const MAINLINE_LIGHT: ThemeTokens = {
  accent: BRAND_BLUE,
  surface: '#F9FAFD',
  surfaceRaised: '#E9ECF4',
  paper: '#FFFFFF',
  ink: '#181D2B',
  inkSecondary: '#4A5268',
  separator: '#DDE1EA',
};
export const MAINLINE_DARK: ThemeTokens = {
  accent: '#8FA8FF',
  surface: '#14161C',
  surfaceRaised: '#2A2E38',
  paper: '#1B1E26',
  ink: '#EEF0F5',
  inkSecondary: '#B7BDCB',
  separator: '#333845',
};

/** Ported verbatim from ClassMusic `AppTheme.tokens` (which is ClassMate's ThemePreset). */
export const THEME_TOKENS: Record<Exclude<ThemeId, 'system'>, ThemeTokens> = {
  light: { accent: '#256489', surface: '#F6F9FE', surfaceRaised: '#E5E8ED', paper: '#FFFFFF', ink: '#181C20', inkSecondary: '#41474D', separator: '#C1C7CE' },
  coffee: { accent: '#88511E', surface: '#F3E9D8', surfaceRaised: '#E9DCC7', paper: '#FBF4E7', ink: '#3B2F25', inkSecondary: '#6A5B4B', separator: '#CDBBA0' },
  matcha: { accent: '#416835', surface: '#F1F4E7', surfaceRaised: '#DFE5CC', paper: '#F8FAEF', ink: '#2B3327', inkSecondary: '#586353', separator: '#C4CCAF' },
  rose: { accent: '#8D4A5D', surface: '#FAF4ED', surfaceRaised: '#EADFD4', paper: '#FFFAF3', ink: '#575279', inkSecondary: '#797593', separator: '#DDD0C4' },
  sand: { accent: '#8C4F26', surface: '#F5EDE0', surfaceRaised: '#E4D7C2', paper: '#FCF6EC', ink: '#3E342A', inkSecondary: '#6E6152', separator: '#D2C2AB' },
  sky: { accent: '#38608F', surface: '#EDF3F9', surfaceRaised: '#D6E2ED', paper: '#F6FAFD', ink: '#27333E', inkSecondary: '#556472', separator: '#C0CEDC' },
  lavender: { accent: '#66558E', surface: '#F3EFFA', surfaceRaised: '#DFD8ED', paper: '#FAF7FE', ink: '#332C43', inkSecondary: '#635A73', separator: '#CEC4DE' },
  peach: { accent: '#904B3F', surface: '#FBEEE7', surfaceRaised: '#EBD8CD', paper: '#FFF7F2', ink: '#43322C', inkSecondary: '#77605A', separator: '#DCC7BD' },
  mint: { accent: '#096B5A', surface: '#EAF4EF', surfaceRaised: '#D1E1DA', paper: '#F4FAF7', ink: '#26332E', inkSecondary: '#54655E', separator: '#BFD3CB' },
  dark: { accent: '#94CDF7', surface: '#101417', surfaceRaised: '#262A2E', paper: '#0A0F12', ink: '#DFE3E8', inkSecondary: '#C1C7CE', separator: '#41474D' },
  midnight: { accent: '#8FA6FF', surface: '#0E1428', surfaceRaised: '#212A48', paper: '#0A0F20', ink: '#DCE2F4', inkSecondary: '#9AA6C6', separator: '#2E3A5C' },
  nord: { accent: '#88C0D0', surface: '#2E3440', surfaceRaised: '#434C5E', paper: '#272C36', ink: '#ECEFF4', inkSecondary: '#C8CFDC', separator: '#434C5E' },
  forest: { accent: '#A7C080', surface: '#2D353B', surfaceRaised: '#3D484D', paper: '#272E33', ink: '#D3C6AA', inkSecondary: '#A6B0A0', separator: '#3D484D' },
  dracula: { accent: '#BD93F9', surface: '#282A36', surfaceRaised: '#3C3F51', paper: '#21222C', ink: '#F8F8F2', inkSecondary: '#B8BAC8', separator: '#44475A' },
  obsidian: { accent: '#57D6E0', surface: '#111315', surfaceRaised: '#23272B', paper: '#0B0C0E', ink: '#E4E6E8', inkSecondary: '#9BA1A6', separator: '#2A2F34' },
  wine: { accent: '#EC9AAE', surface: '#241016', surfaceRaised: '#3D1F28', paper: '#1C0B10', ink: '#F3DDE3', inkSecondary: '#C79AA4', separator: '#4A2C33' },
  solarized: { accent: '#C99A2E', surface: '#002B36', surfaceRaised: '#0E4653', paper: '#00232C', ink: '#93A1A1', inkSecondary: '#839496', separator: '#0E4653' },
  plum: { accent: '#C9A2ED', surface: '#1E1526', surfaceRaised: '#342740', paper: '#17101E', ink: '#E9DFF3', inkSecondary: '#B1A3C0', separator: '#362A43' },
  ocean: { accent: '#56C7D4', surface: '#0C1E24', surfaceRaised: '#1D3A43', paper: '#07171C', ink: '#DBEBEE', inkSecondary: '#98B0B6', separator: '#23424B' },
};

export const LIGHT_FAMILY: ThemeId[] = ['light', 'coffee', 'matcha', 'rose', 'sand', 'sky', 'lavender', 'peach', 'mint'];
export const DARK_FAMILY: ThemeId[] = ['dark', 'midnight', 'nord', 'forest', 'dracula', 'obsidian', 'wine', 'solarized', 'plum', 'ocean'];

export function themeName(id: ThemeId): string {
  if (id === 'system') return 'System default';
  if (id === 'rose') return 'Rosé';
  return id[0]!.toUpperCase() + id.slice(1);
}

export const prefersDark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;

export function resolveTheme(id: ThemeId, systemDark = prefersDark()): { tokens: ThemeTokens; dark: boolean } {
  if (id === 'system') return systemDark ? { tokens: MAINLINE_DARK, dark: true } : { tokens: MAINLINE_LIGHT, dark: false };
  return { tokens: THEME_TOKENS[id], dark: DARK_FAMILY.includes(id) };
}

/** CSS variables for a theme — also cached in localStorage so index.html can paint the right colours before React loads. */
export function themeVars(t: ThemeTokens, dark: boolean): Record<string, string> {
  const mix = (a: string, pct: number, b: string) => `color-mix(in oklab, ${a} ${pct}%, ${b})`;
  return {
    '--brand': t.accent,
    '--bg': t.surface,
    '--surface': t.paper,
    '--surface-2': mix(t.paper, 55, t.surfaceRaised),
    '--surface-3': t.surfaceRaised,
    '--ink': t.ink,
    '--ink-2': t.inkSecondary,
    '--ink-3': mix(t.inkSecondary, 78, t.surface),
    '--line': t.separator,
    '--line-strong': mix(t.separator, 78, t.ink),
    // Pastel accents on dark themes need dark text on top of them.
    '--on-brand': dark ? t.paper : '#FFFFFF',
    '--theme-surface-hex': t.surface,
    '--theme-accent-hex': t.accent,
  };
}

/* ---------------- Fonts ---------------- */

export type FontId = 'cabinet' | 'system' | 'noteworthy' | 'bradley' | 'marker' | 'chalkboard' | 'snell' | 'savoye' | 'rounded' | 'newyork' | 'georgia' | 'menlo';

const SYSTEM_STACK = `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', Roboto, system-ui, sans-serif`;

export interface FontDef {
  id: FontId;
  name: string;
  /** Apple's own face first (what ClassMate uses on iOS); an open-licensed look-alike elsewhere. */
  stack: string;
  /** Lazy-loads the open-licensed fallback face for non-Apple platforms. */
  load?: () => Promise<unknown>;
  /** Not selectable until its licence is approved by the owner. */
  pendingLicence?: boolean;
}

/** Same ids, names and order as ClassMate-Notes' FontLibrary / ClassMusic's AppFont. */
export const FONTS: FontDef[] = [
  { id: 'cabinet', name: 'Cabinet Grotesk', stack: `'Cabinet Grotesk', ${SYSTEM_STACK}`, pendingLicence: true },
  { id: 'system', name: 'Default', stack: SYSTEM_STACK },
  { id: 'noteworthy', name: 'Noteworthy', stack: `'Noteworthy', 'Patrick Hand', ${SYSTEM_STACK}`, load: () => import('@fontsource/patrick-hand') },
  { id: 'bradley', name: 'Bradley Hand', stack: `'Bradley Hand', 'Caveat', ${SYSTEM_STACK}`, load: () => import('@fontsource/caveat') },
  { id: 'marker', name: 'Marker Felt', stack: `'Marker Felt', 'Permanent Marker', ${SYSTEM_STACK}`, load: () => import('@fontsource/permanent-marker') },
  { id: 'chalkboard', name: 'Chalkboard', stack: `'Chalkboard SE', 'Chalkboard', 'Short Stack', ${SYSTEM_STACK}`, load: () => import('@fontsource/short-stack') },
  { id: 'snell', name: 'Snell Roundhand', stack: `'Snell Roundhand', 'Great Vibes', ${SYSTEM_STACK}`, load: () => import('@fontsource/great-vibes') },
  { id: 'savoye', name: 'Savoye', stack: `'Savoye LET', 'Pinyon Script', ${SYSTEM_STACK}`, load: () => import('@fontsource/pinyon-script') },
  { id: 'rounded', name: 'Rounded', stack: `ui-rounded, 'SF Pro Rounded', 'Nunito Variable', ${SYSTEM_STACK}`, load: () => import('@fontsource-variable/nunito') },
  { id: 'newyork', name: 'New York', stack: `ui-serif, 'New York', 'Source Serif 4 Variable', Georgia, serif`, load: () => import('@fontsource-variable/source-serif-4') },
  { id: 'georgia', name: 'Georgia', stack: `Georgia, 'Gelasio', serif`, load: () => import('@fontsource/gelasio') },
  { id: 'menlo', name: 'Menlo', stack: `Menlo, ui-monospace, 'JetBrains Mono Variable', monospace`, load: () => import('@fontsource-variable/jetbrains-mono') },
];

export const fontDef = (id: FontId) => FONTS.find((f) => f.id === id) ?? FONTS[1]!;

/* ---------------- Board & pieces ---------------- */

export type BoardTheme = 'match' | 'blue' | 'slate' | 'brown' | 'green';
export const BOARD_THEMES: { id: BoardTheme; name: string }[] = [
  { id: 'match', name: 'Match theme' },
  { id: 'blue', name: 'Blue' },
  { id: 'slate', name: 'Slate' },
  { id: 'brown', name: 'Wood' },
  { id: 'green', name: 'Green' },
];

export type PieceSet = 'cburnett' | 'merida' | 'chessnut' | 'fantasy' | 'spatial' | 'celtic' | 'rhosgfx' | 'mpchess';
export const PIECE_SETS: { id: PieceSet; name: string }[] = [
  { id: 'cburnett', name: 'Classic' },
  { id: 'merida', name: 'Merida' },
  { id: 'chessnut', name: 'Chessnut' },
  { id: 'fantasy', name: 'Fantasy' },
  { id: 'spatial', name: 'Spatial' },
  { id: 'celtic', name: 'Celtic' },
  { id: 'rhosgfx', name: 'Rhos' },
  { id: 'mpchess', name: 'MP Chess' },
];

const ROLES = { pawn: 'P', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K' } as const;

/** CSS that swaps chessground's piece sprites (cburnett is built in, so it needs no override). */
export function pieceCss(set: PieceSet): string {
  if (set === 'cburnett') return '';
  const rules: string[] = [];
  for (const color of ['white', 'black'] as const) {
    for (const [role, letter] of Object.entries(ROLES)) {
      rules.push(`.cg-wrap piece.${role}.${color}{background-image:url('/pieces/${set}/${color[0]}${letter}.svg')}`);
    }
  }
  return rules.join('\n');
}
