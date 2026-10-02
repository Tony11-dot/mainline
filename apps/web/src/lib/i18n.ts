/**
 * Translations. The English text itself is the key: `t('Learn new moves')`, `t('{n} due', { n })`.
 * Each language is a JSON catalog in packages/shared/locales (English → translation), loaded on demand; anything
 * missing falls back to English. `pnpm --filter @mainline/web i18n` regenerates en.json from the
 * source and lists what each language still lacks.
 *
 * Plurals: `tn(count, '{n} move', '{n} moves')`. Catalogs store the English plural ("{n} moves") as the
 * key and an object of CLDR categories as the value ({ one, few, many, other, … }), so Arabic, Russian
 * and Polish get their real plural forms.
 */
import { createElement, Fragment, type ReactNode } from 'react';
import { create } from 'zustand';

export const LOCALES = [
  { id: 'auto', name: 'Automatic' },
  { id: 'en', name: 'English' },
  { id: 'ar', name: 'العربية' },
  { id: 'de', name: 'Deutsch' },
  { id: 'es', name: 'Español' },
  { id: 'fa', name: 'فارسی' },
  { id: 'fr', name: 'Français' },
  { id: 'he', name: 'עברית' },
  { id: 'hi', name: 'हिन्दी' },
  { id: 'id', name: 'Bahasa Indonesia' },
  { id: 'it', name: 'Italiano' },
  { id: 'ja', name: '日本語' },
  { id: 'ko', name: '한국어' },
  { id: 'nl', name: 'Nederlands' },
  { id: 'pl', name: 'Polski' },
  { id: 'pt', name: 'Português' },
  { id: 'ru', name: 'Русский' },
  { id: 'tr', name: 'Türkçe' },
  { id: 'uk', name: 'Українська' },
  { id: 'vi', name: 'Tiếng Việt' },
  { id: 'zh', name: '简体中文' },
] as const;
export type LocaleId = (typeof LOCALES)[number]['id'];
export type Lang = Exclude<LocaleId, 'auto'>;

const RTL = new Set<string>(['ar', 'fa', 'he']);
const LANGS = new Set<string>(LOCALES.map((l) => l.id).filter((id) => id !== 'auto'));

type Plural = Partial<Record<Intl.LDMLPluralRule, string>>;
type Catalog = Record<string, string | Plural>;

// Catalogs are shared with the API (reminder notifications): packages/shared/locales.
const catalogs = import.meta.glob<Catalog>(['../../../../packages/shared/locales/*.json', '!../../../../packages/shared/locales/en.json'], { import: 'default' });

interface I18nState {
  lang: Lang;
  dict: Catalog;
}
/** The active language and its catalog. Components re-render through the App's key on `lang`. */
export const useI18n = create<I18nState>(() => ({ lang: 'en', dict: {} }));

/** The device's preferred language that MainLine speaks, else English. */
export function systemLang(): Lang {
  const prefs = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  for (const tag of prefs) {
    const base = tag.toLowerCase().split('-')[0]!;
    // Hebrew used to be "iw" on older Android.
    const id = base === 'iw' ? 'he' : base;
    if (LANGS.has(id)) return id as Lang;
  }
  return 'en';
}

export function resolveLocale(pref: LocaleId): Lang {
  return pref === 'auto' || !LANGS.has(pref) ? systemLang() : pref;
}

/** BCP 47 tag for Intl formatting (dates, numbers), matching the app language rather than the browser's. */
export function intlLocale(): string {
  const l = useI18n.getState().lang;
  return l === 'zh' ? 'zh-CN' : l === 'pt' ? 'pt-BR' : l;
}

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? fmtVar(vars[k]!) : m)) : s;
const fmtVar = (v: string | number) => (typeof v === 'number' ? v.toLocaleString(intlLocale()) : v);

/** Translate English UI text. Unknown text (or a missing catalog) shows the English. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const hit = useI18n.getState().dict[text];
  return fill(typeof hit === 'string' && hit ? hit : text, vars);
}

/** Plural-aware: `tn(count, '{n} position', '{n} positions')`. `{n}` is the count; more vars may follow. */
export function tn(count: number, one: string, other: string, vars?: Record<string, string | number>): string {
  const { dict } = useI18n.getState();
  const all = { n: count, ...vars };
  const hit = dict[other];
  if (hit && typeof hit === 'object') {
    const cat = new Intl.PluralRules(intlLocale()).select(count);
    const form = hit[cat] ?? hit.other;
    if (form) return fill(form, all);
  }
  if (typeof hit === 'string' && hit) return fill(hit, all);
  return fill(new Intl.PluralRules('en').select(count) === 'one' ? one : other, all);
}

/**
 * Rich text: placeholders become elements, so whole sentences stay translatable.
 * `tx('You played {played} instead of {expected}', { played: <b>Bc4</b>, expected: <b>Bb5</b> })`
 */
export function tx(text: string, parts: Record<string, ReactNode>): ReactNode {
  const hit = useI18n.getState().dict[text];
  const src = typeof hit === 'string' && hit ? hit : text;
  return src.split(/(\{\w+\})/).map((seg, i) => {
    const k = /^\{(\w+)\}$/.exec(seg)?.[1];
    const node = k && k in parts ? parts[k] : seg;
    return createElement(Fragment, { key: i }, typeof node === 'number' ? fmtVar(node) : node);
  });
}

/** Marks English kept in a constant (labels, option lists) for the catalog; translate it with t() where it's shown. */
export const msg = <S extends string>(text: S): S => text;

/** React-friendly accessor kept for existing call sites: `const t = useT(); t('Today')`. */
export function useT() {
  useI18n((s) => s.lang);
  return t;
}

/** Switch language: load its catalog, then flip `lang` (the App remounts its tree on that key). */
export async function applyLocale(pref: LocaleId) {
  const lang = resolveLocale(pref);
  let dict: Catalog = {};
  if (lang !== 'en') {
    const load = catalogs[`../../../../packages/shared/locales/${lang}.json`];
    try {
      dict = load ? await load() : {};
    } catch {
      dict = {}; // offline before the chunk was cached: English until it loads next time
    }
  }
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL.has(lang) ? 'rtl' : 'ltr';
  if (useI18n.getState().lang !== lang || useI18n.getState().dict !== dict) useI18n.setState({ lang, dict });
}

/** 0.42 → "42%" in the app language (some languages put the sign first or use other digits). */
export const fmtPercent = (x: number) => new Intl.NumberFormat(intlLocale(), { style: 'percent', maximumFractionDigits: 0 }).format(x);

export const isRtl = () => RTL.has(useI18n.getState().lang);
