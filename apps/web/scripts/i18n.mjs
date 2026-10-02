// Collects every t('…') / msg('…') / tn(n, '…', '…') string in src (and shared reminder wording) into
// packages/shared/locales/en.json, then reports what each
// language catalog is missing (and keys it has that the app no longer uses).
//   node scripts/i18n.mjs          write en.json + print a report
//   node scripts/i18n.mjs --check  exit 1 if any language misses a string (CI)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname;
// The shared package words reminder notifications through the same catalogs.
const SHARED = new URL('../../../packages/shared/src/', import.meta.url).pathname;
const LOCALES = new URL('../../../packages/shared/locales/', import.meta.url).pathname;

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (f !== 'locales') walk(p);
    } else if (/\.(tsx?)$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== 'i18n.ts') files.push(p);
  }
})(SRC);
for (const f of readdirSync(SHARED)) if (/\.ts$/.test(f) && !/\.test\.ts$/.test(f) && f !== 'i18n.ts') files.push(join(SHARED, f));

// A JS string literal: '…' or "…" (escapes allowed), or a template literal with no ${}.
const STR = String.raw`'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|\`(?:[^\`\\$]|\\.)*\``;
// t('…') translates in place; msg('…') marks English kept in a constant and translated where it's shown.
const T = new RegExp(String.raw`\b(?:t|tl|tx|msg)\(\s*(${STR})`, 'g');
const TN = new RegExp(String.raw`\btn\(\s*[^,]+?,\s*(${STR})\s*,\s*(${STR})`, 'g');
const unquote = (s) => {
  const q = s[0];
  const body = s.slice(1, -1);
  if (q === '`') return body.replace(/\\`/g, '`').replace(/\\\\/g, '\\');
  return JSON.parse(q === '"' ? s : `"${body.replace(/\\'/g, "'").replace(/"/g, '\\"')}"`);
};

const singular = new Map(); // text -> first file
const plural = new Map(); // other -> one
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(T)) {
    const s = unquote(m[1]);
    if (!singular.has(s)) singular.set(s, f);
  }
  for (const m of src.matchAll(TN)) plural.set(unquote(m[2]), unquote(m[1]));
}

const en = {};
for (const k of [...singular.keys()].sort()) en[k] = k;
for (const [other, one] of [...plural].sort()) en[other] = { one, other };
writeFileSync(join(LOCALES, 'en.json'), JSON.stringify(en, null, 2) + '\n');

const keys = Object.keys(en);
let bad = 0;
for (const f of readdirSync(LOCALES).filter((f) => f.endsWith('.json') && f !== 'en.json').sort()) {
  const cat = JSON.parse(readFileSync(join(LOCALES, f), 'utf8'));
  const missing = keys.filter((k) => cat[k] === undefined || cat[k] === '');
  const stale = Object.keys(cat).filter((k) => !(k in en));
  // Placeholders must survive translation. The zero/one/two plural forms may spell the number
  // out ("יומיים", "يوم واحد"), so only {n} is optional there.
  const broken = keys.filter((k) => {
    const v = cat[k];
    if (v === undefined) return false;
    const want = new Set(k.match(/\{\w+\}/g) ?? []);
    const forms = typeof v === 'string' ? [['other', v]] : Object.entries(v);
    return forms.some(([cat, form]) => [...want].some((p) => !form.includes(p) && !(p === '{n}' && ['zero', 'one', 'two'].includes(cat))));
  });
  if (missing.length || broken.length) bad++;
  console.log(`${f.padEnd(8)} ${keys.length - missing.length}/${keys.length}${stale.length ? `  (${stale.length} unused)` : ''}${broken.length ? `  ${broken.length} lost a {placeholder}` : ''}`);
  if (process.argv.includes('--verbose')) for (const k of [...missing, ...broken]) console.log('   ', JSON.stringify(k));
}
console.log(`${keys.length} strings (${plural.size} plural) in ${files.length} files`);
if (process.argv.includes('--check') && bad) process.exit(1);
