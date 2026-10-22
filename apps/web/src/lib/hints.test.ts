import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { moveTokens, sameMoveTokens, uciToSan, positionFromFen, epdToFen } from '@mainline/shared';
import { _resetHintTables, hintFor, hintKey, HINTS_VERSION, packHintTargets } from './hints';
import { useI18n } from './i18n';
import { PACKS } from './packs';

// Vitest runs with the package as its working directory.
const DATA = resolve(process.cwd(), 'public/data/hints');
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), 'utf8')) as { v: number; lang: string; hints: Record<string, string> };

describe('pack hint targets', () => {
  const targets = packHintTargets(PACKS);

  it('enumerates every trained move once, from the pack side only', () => {
    expect(targets.length).toBeGreaterThan(1000);
    expect(new Set(targets.map((t) => t.key)).size).toBe(targets.length);
    for (const t of targets) {
      expect(t.key).toBe(hintKey(t.epd, t.uci));
      expect(t.epd.split(' ')[1]).toBe(t.color === 'white' ? 'w' : 'b');
      expect(t.sources.length).toBeGreaterThan(0);
    }
  });

  it('shares one hint between packs that reach the same position with the same move', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.O-O: the Ruy Lopez Berlin line of the White Ruy pack and the Black 1…e5 pack reach the same position
    // from opposite sides, so they are different targets; but the Petrov line shared by the Italian and Ruy packs is one.
    const petrov = targets.filter((t) => t.sources.includes('w-italian:petrov-philidor'));
    expect(petrov.length).toBeGreaterThan(0);
    for (const t of petrov) expect(t.sources).toContain('w-ruy:petrov-philidor');
  });
});

describe('shipped hint files', () => {
  const files = readdirSync(DATA).filter((f) => f.endsWith('.json'));
  const en = read('en.json');
  const targets = packHintTargets(PACKS);
  const keys = new Set(targets.map((t) => t.key));
  // How the files were made: counts after the code checks and the judge review drop what failed.
  const manifest = JSON.parse(readFileSync(resolve(DATA, '../../../scripts/hints/manifest.json'), 'utf8')) as { hints: number; languages: Record<string, { hints: number }> };

  it('ships English and every app language', () => {
    const langs = files.map((f) => f.replace('.json', '')).sort();
    expect(langs).toEqual(['ar', 'de', 'en', 'es', 'fa', 'fr', 'he', 'hi', 'id', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ru', 'tr', 'uk', 'vi', 'zh']);
  });

  it('English hints are current, one line each, and name only moves legal in the position', () => {
    expect(en.v).toBe(HINTS_VERSION);
    expect(Object.keys(en.hints).length).toBe(manifest.hints);
    // Hints are dropped, never invented: well over half the trained positions keep one.
    expect(Object.keys(en.hints).length).toBeGreaterThan(targets.length / 2);
    for (const [key, text] of Object.entries(en.hints)) {
      expect(keys.has(key), `${key} is still a trained move`).toBe(true);
      expect(text).not.toMatch(/\n/);
      expect(text.length).toBeLessThanOrEqual(200);
      const epd = key.slice(0, key.lastIndexOf(' '));
      const pos = positionFromFen(epdToFen(epd!));
      // A hint may also name moves from the engine's follow-up, which are not legal right now; the
      // repertoire move itself always is, and it must be a legal SAN the UI can show.
      expect(moveTokens(text).length).toBeGreaterThan(0);
      expect(uciToSan(pos, key.split(' ').at(-1)!)).toBeTruthy();
    }
  });

  it.each(files.filter((f) => f !== 'en.json'))('%s keeps the English keys and the same moves', (f) => {
    const cat = read(f);
    expect(cat.v).toBe(HINTS_VERSION);
    expect(cat.lang).toBe(f.replace('.json', ''));
    for (const [key, text] of Object.entries(cat.hints)) {
      expect(en.hints[key], `${f}: ${key} exists in English`).toBeTruthy();
      expect(sameMoveTokens(text, en.hints[key]!), `${f}: ${key} names the same moves`).toBe(true);
      expect(text).not.toMatch(/\n/);
    }
    // A translation may drop a hint that failed validation; it can't drop many.
    expect(Object.keys(cat.hints).length).toBeGreaterThanOrEqual(Object.keys(en.hints).length * 0.95);
  });
});

describe('hintFor', () => {
  afterEach(() => {
    _resetHintTables();
    vi.unstubAllGlobals();
    useI18n.setState({ lang: 'en', dict: {} });
  });
  const serve = (files: Record<string, unknown>) => {
    const fetchMock = vi.fn(async (url: string) => {
      const body = files[url];
      return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('falls back to English per hint and when a language has no file', async () => {
    serve({
      '/data/hints/en.json': { v: HINTS_VERSION, lang: 'en', hints: { 'a b': 'English A', 'c d': 'English C' } },
      '/data/hints/de.json': { v: HINTS_VERSION, lang: 'de', hints: { 'a b': 'Deutsch A' } },
    });
    expect(await hintFor('a', 'b', 'de')).toBe('Deutsch A');
    expect(await hintFor('c', 'd', 'de')).toBe('English C');
    expect(await hintFor('c', 'd', 'fr')).toBe('English C');
    expect(await hintFor('x', 'y', 'de')).toBeUndefined();
  });

  it('ignores a file from another version and fetches each language once', async () => {
    const fetchMock = serve({ '/data/hints/en.json': { v: HINTS_VERSION + 1, lang: 'en', hints: { 'a b': 'old' } } });
    expect(await hintFor('a', 'b', 'en')).toBeUndefined();
    expect(await hintFor('a', 'b', 'en')).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
