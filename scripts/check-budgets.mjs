// Performance budgets (PLAN §10): fails CI when the first-load payload grows past the limits.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const dist = new URL('../apps/web/dist/', import.meta.url).pathname;
const html = readFileSync(`${dist}index.html`, 'utf8');
const entryJs = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
const entryCss = [...html.matchAll(/href="\/(assets\/[^"]+\.css)"/g)].map((m) => m[1]);
const gz = (f) => gzipSync(readFileSync(`${dist}${f}`)).length;
const js = entryJs.reduce((a, f) => a + gz(f), 0);
const css = entryCss.reduce((a, f) => a + gz(f), 0);
const BUDGET = { js: 180 * 1024, css: 24 * 1024 };
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`first-load JS ${kb(js)} (budget ${kb(BUDGET.js)}) · CSS ${kb(css)} (budget ${kb(BUDGET.css)})`);
const chunks = readdirSync(`${dist}assets`).filter((f) => f.endsWith('.js'));
const biggest = chunks.map((f) => [f, gz(`assets/${f}`)]).sort((a, b) => b[1] - a[1]).slice(0, 5);
for (const [f, n] of biggest) console.log(`  ${kb(n).padStart(9)}  ${f}`);
if (js > BUDGET.js || css > BUDGET.css) {
  console.error('✗ performance budget exceeded');
  process.exit(1);
}
console.log('✓ within budget');
