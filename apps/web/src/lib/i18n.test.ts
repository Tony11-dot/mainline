import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyLocale, LOCALES, resolveLocale, systemLang, t, tn, tx, useI18n } from './i18n';

type Catalog = Record<string, string | Partial<Record<Intl.LDMLPluralRule, string>>>;
const catalogs = import.meta.glob<Catalog>('../../../../packages/shared/locales/*.json', { eager: true, import: 'default' });
const catalog = (lang: string) => catalogs[`../../../../packages/shared/locales/${lang}.json`]!;

const deviceLanguages = (langs: string[]) => vi.spyOn(navigator, 'languages', 'get').mockReturnValue(langs);

afterEach(async () => {
  vi.restoreAllMocks();
  await applyLocale('en');
});

describe('language choice', () => {
  it('takes the first device language MainLine speaks, else English', () => {
    deviceLanguages(['sw-KE', 'de-AT', 'fr']);
    expect(systemLang()).toBe('de');
    deviceLanguages(['pt-BR']);
    expect(systemLang()).toBe('pt');
    deviceLanguages(['ZH-Hans-CN']);
    expect(systemLang()).toBe('zh');
    deviceLanguages(['sw', 'am']);
    expect(systemLang()).toBe('en');
  });

  it('reads old Android’s "iw" as Hebrew and "in" as Indonesian', () => {
    deviceLanguages(['iw-IL']);
    expect(systemLang()).toBe('he');
    deviceLanguages(['in-ID']);
    expect(systemLang()).toBe('id');
  });

  it('follows the device on "automatic" or an unknown setting', () => {
    deviceLanguages(['ja-JP']);
    expect(resolveLocale('auto')).toBe('ja');
    expect(resolveLocale('xx' as never)).toBe('ja');
    expect(resolveLocale('fr')).toBe('fr');
  });
});

describe('switching language', () => {
  it('lays out right to left for Hebrew, Arabic and Persian only', async () => {
    for (const { id } of LOCALES) {
      if (id === 'auto') continue;
      await applyLocale(id);
      expect(document.documentElement.lang).toBe(id);
      expect(document.documentElement.dir).toBe(['he', 'ar', 'fa'].includes(id) ? 'rtl' : 'ltr');
    }
  });

  it('translates from the catalog and drops it again for English', async () => {
    await applyLocale('he');
    expect(useI18n.getState().lang).toBe('he');
    expect(t('Review')).toBe(catalog('he')['Review']);
    expect(t('Text the catalog has never seen')).toBe('Text the catalog has never seen');
    await applyLocale('en');
    expect(t('Review')).toBe('Review');
  });

  it('uses each language’s plural forms', async () => {
    await applyLocale('ru');
    const ru = catalog('ru')['{n} moves'] as Record<string, string>;
    const moves = (n: number) => tn(n, '{n} move', '{n} moves');
    expect([moves(1), moves(3), moves(5), moves(21)]).toEqual([ru.one!.replace('{n}', '1'), ru.few!.replace('{n}', '3'), ru.many!.replace('{n}', '5'), ru.one!.replace('{n}', '21')]);
    await applyLocale('he');
    expect(tn(2, '{n} day', '{n} days')).toBe((catalog('he')['{n} days'] as Record<string, string>).two);
  });

  it('keeps rich-text parts in a translated sentence', async () => {
    const text = 'You played {played} instead of {expected} · now due';
    const html = (lang: Parameters<typeof applyLocale>[0]) =>
      applyLocale(lang).then(() => renderToStaticMarkup(createElement('p', null, tx(text, { played: createElement('b', null, 'Bc4'), expected: createElement('b', null, 'Bb5') }))));
    expect(await html('en')).toBe('<p>You played <b>Bc4</b> instead of <b>Bb5</b> · now due</p>');
    const fr = await html('fr');
    expect(catalog('fr')[text]).not.toBe(text);
    expect(fr).not.toContain('You played');
    expect(fr).toContain('<b>Bc4</b>');
    expect(fr).toContain('<b>Bb5</b>');
    expect(fr).not.toContain('{');
  });
});

describe('catalogs', () => {
  // Counts a player sees (moves, days, positions): every plural form a language needs for them is written,
  // so none falls back to "other" with the wrong grammar.
  const counts = Array.from({ length: 1001 }, (_, n) => n);
  const en = catalog('en');
  const plurals = Object.keys(en).filter((k) => typeof en[k] === 'object');

  it.each(LOCALES.map((l) => l.id).filter((id) => id !== 'auto' && id !== 'en'))('%s has every plural form it needs', (lang) => {
    const rules = new Intl.PluralRules(lang === 'zh' ? 'zh-CN' : lang === 'pt' ? 'pt-BR' : lang);
    const needed = new Set(counts.map((n) => rules.select(n)));
    const cat = catalog(lang);
    const gaps = plurals.flatMap((k) => {
      const v = cat[k];
      if (typeof v !== 'object') return [];
      return [...needed].filter((c) => !v[c]).map((c) => `${k} [${c}]`);
    });
    expect(gaps).toEqual([]);
  });
});
