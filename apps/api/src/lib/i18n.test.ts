import { describe, expect, it } from 'vitest';
import { english } from '@mainline/shared';
import { translatorFor } from './i18n';

describe('reminder language', () => {
  it('uses the subscriber’s catalog', () => {
    const fr = translatorFor('fr');
    expect(fr.lang).toBe('fr');
    expect(fr.t('Review')).not.toBe('Review');
    expect(translatorFor('fr')).toBe(fr);
  });

  it('speaks English for English, unknown and missing languages', () => {
    for (const lang of ['en', 'xx', '', null, undefined]) expect(translatorFor(lang)).toBe(english);
  });
});
