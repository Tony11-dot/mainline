/**
 * i18n scaffolding. English is complete; Hebrew and Arabic are previews (navigation + key labels) to
 * prove the right-to-left layout. Add keys to `en` first; other locales fall back to English.
 */
import { usePrefs } from './prefs';

const en = {
  'nav.today': 'Today',
  'nav.repertoire': 'Repertoire',
  'nav.explore': 'Explore',
  'nav.games': 'Games',
  'nav.settings': 'Settings',
  'today.title': 'Today',
  'today.trainNow': 'Train now',
  'today.learnNew': 'Learn new moves',
  'settings.title': 'Settings',
  'settings.language': 'Language',
} as const;

export type MsgKey = keyof typeof en;
type Dict = Partial<Record<MsgKey, string>>;

const he: Dict = {
  'nav.today': 'היום',
  'nav.repertoire': 'רפרטואר',
  'nav.explore': 'חקירה',
  'nav.games': 'משחקים',
  'nav.settings': 'הגדרות',
  'today.title': 'היום',
  'today.trainNow': 'להתאמן עכשיו',
  'today.learnNew': 'ללמוד מהלכים חדשים',
  'settings.title': 'הגדרות',
  'settings.language': 'שפה',
};

const ar: Dict = {
  'nav.today': 'اليوم',
  'nav.repertoire': 'الذخيرة',
  'nav.explore': 'استكشاف',
  'nav.games': 'المباريات',
  'nav.settings': 'الإعدادات',
  'today.title': 'اليوم',
  'today.trainNow': 'تدرّب الآن',
  'today.learnNew': 'تعلّم نقلات جديدة',
  'settings.title': 'الإعدادات',
  'settings.language': 'اللغة',
};

export const LOCALES = [
  { id: 'auto', name: 'Automatic' },
  { id: 'en', name: 'English' },
  { id: 'he', name: 'עברית (preview)' },
  { id: 'ar', name: 'العربية (preview)' },
] as const;
export type LocaleId = (typeof LOCALES)[number]['id'];

const DICTS: Record<string, Dict> = { en, he, ar };
const RTL = new Set(['he', 'ar']);

export function resolveLocale(pref: LocaleId): string {
  if (pref !== 'auto') return pref;
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2);
  return DICTS[nav] ? nav : 'en';
}

export function translate(locale: string, key: MsgKey): string {
  return DICTS[locale]?.[key] ?? en[key];
}

/** React hook: `const t = useT(); t('nav.today')` */
export function useT() {
  const locale = resolveLocale(usePrefs((s) => s.locale));
  return (key: MsgKey) => translate(locale, key);
}

export function applyLocale(pref: LocaleId) {
  const locale = resolveLocale(pref);
  document.documentElement.lang = locale;
  document.documentElement.dir = RTL.has(locale) ? 'rtl' : 'ltr';
}
