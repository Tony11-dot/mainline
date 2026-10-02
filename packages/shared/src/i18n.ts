/**
 * The translation core shared by the app and the API (reminder notifications).
 * Catalogs live in packages/shared/locales/<lang>.json: English text → translation, or for plurals an
 * object of CLDR categories ({ one, few, many, other, … }) keyed by the English plural form.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>>;
export type Catalog = Record<string, string | PluralForms>;

export interface Translator {
  lang: string;
  /** `t('{n} due', { n })` — unknown text falls back to the English. */
  t(text: string, vars?: Record<string, string | number>): string;
  /** `tn(count, '{n} move', '{n} moves')` — `{n}` is the count. */
  tn(count: number, one: string, other: string, vars?: Record<string, string | number>): string;
}

/** BCP 47 tag for Intl formatting from an app language code. */
export const intlTag = (lang: string) => (lang === 'zh' ? 'zh-CN' : lang === 'pt' ? 'pt-BR' : lang);

export function makeTranslator(lang: string, dict: Catalog): Translator {
  const tag = intlTag(lang);
  const num = (v: string | number) => (typeof v === 'number' ? v.toLocaleString(tag) : v);
  const fill = (s: string, vars?: Record<string, string | number>) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? num(vars[k]!) : m)) : s);
  return {
    lang,
    t(text, vars) {
      const hit = dict[text];
      return fill(typeof hit === 'string' && hit ? hit : text, vars);
    },
    tn(count, one, other, vars) {
      const all = { n: count, ...vars };
      const hit = dict[other];
      if (hit && typeof hit === 'object') {
        const form = hit[new Intl.PluralRules(tag).select(count)] ?? hit.other;
        if (form) return fill(form, all);
      }
      if (typeof hit === 'string' && hit) return fill(hit, all);
      return fill(new Intl.PluralRules('en').select(count) === 'one' ? one : other, all);
    },
  };
}

export const english: Translator = makeTranslator('en', {});
