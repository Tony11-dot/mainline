import { describe, expect, it } from 'vitest';
import { english, intlTag, makeTranslator } from './i18n';

// Each form names its own CLDR category, so a test reads which one the count picked.
const forms = { zero: 'zero', one: 'one', two: 'two', few: 'few', many: 'many', other: 'other' };

describe('translator', () => {
  it('translates known text and falls back to the English for anything else', () => {
    const fr = makeTranslator('fr', { Review: 'Réviser', Learn: '' });
    expect(fr.t('Review')).toBe('Réviser');
    expect(fr.t('Not in the catalog')).toBe('Not in the catalog');
    // An empty translation is a gap, not a blank label.
    expect(fr.t('Learn')).toBe('Learn');
  });

  it('fills placeholders, formats numbers for the language and leaves unknown ones alone', () => {
    const de = makeTranslator('de', { '{n} due': '{n} fällig' });
    expect(de.t('{n} due', { n: 12345 })).toBe('12.345 fällig');
    expect(de.t('{n} due', { n: '12345' })).toBe('12345 fällig');
    expect(de.t('{n} due by {day}', { n: 3 })).toBe('3 due by {day}');
    expect(english.t('{n} due', { n: 12345 })).toBe('12,345 due');
  });

  it('picks the plural form the language needs', () => {
    const ru = makeTranslator('ru', { '{n} moves': { one: 'one', few: 'few', many: 'many', other: 'other' } });
    expect([1, 2, 5, 11, 21, 22, 25, 111].map((n) => ru.tn(n, '{n} move', '{n} moves'))).toEqual(['one', 'few', 'many', 'many', 'one', 'few', 'many', 'many']);
    const ar = makeTranslator('ar', { '{n} moves': forms });
    expect([0, 1, 2, 3, 11, 100].map((n) => ar.tn(n, '{n} move', '{n} moves'))).toEqual(['zero', 'one', 'two', 'few', 'many', 'other']);
    const he = makeTranslator('he', { '{n} days': { one: 'one', two: 'two', other: 'other' } });
    expect([1, 2, 3, 20].map((n) => he.tn(n, '{n} day', '{n} days'))).toEqual(['one', 'two', 'other', 'other']);
  });

  it('falls back to "other" when a plural form is missing, and to English when the entry is', () => {
    const pl = makeTranslator('pl', { '{n} lines': { one: '{n} linia', other: '{n} linii' }, '{n} games': '{n} partii' });
    expect(pl.tn(3, '{n} line', '{n} lines')).toBe('3 linii');
    // A catalog may hold a plural as a plain string.
    expect(pl.tn(3, '{n} game', '{n} games')).toBe('3 partii');
    expect(pl.tn(1, '{n} card', '{n} cards')).toBe('1 card');
    expect(pl.tn(0, '{n} card', '{n} cards')).toBe('0 cards');
    expect(english.tn(1, '{n} card', '{n} cards', { deck: 'x' })).toBe('1 card');
  });

  it('passes extra placeholders through plurals', () => {
    const es = makeTranslator('es', { '{n} moves in {name}': { one: '{n} jugada en {name}', other: '{n} jugadas en {name}' } });
    expect(es.tn(2, '{n} move in {name}', '{n} moves in {name}', { name: 'Italiana' })).toBe('2 jugadas en Italiana');
  });

  it('maps app languages to Intl tags', () => {
    expect([intlTag('zh'), intlTag('pt'), intlTag('he')]).toEqual(['zh-CN', 'pt-BR', 'he']);
  });
});
