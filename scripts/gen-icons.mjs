// Rasterizes the brand icon (apps/web/public/icon.svg) for PWA, Tauri and Capacitor.
// Re-run after changing the brand color: node scripts/gen-icons.mjs [#hex]
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const brand = process.argv[2] ?? readBrand();
function readBrand() {
  const css = readFileSync(`${root}apps/web/src/styles.css`, 'utf8');
  return css.match(/--brand:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? '#1E5EFF';
}
const svg = readFileSync(`${root}apps/web/public/icon.svg`, 'utf8').replace(/fill="#[0-9A-Fa-f]{6}"(?=\/>\n {2}<g)/, `fill="${brand}"`);
writeFileSync(`${root}apps/web/public/icon.svg`, svg);
// Full-bleed square (no rounded corners) for iOS/Android which apply their own masks.
const square = svg.replace('rx="112"', 'rx="0"');
// Maskable: glyph inside the 80% safe zone.
const maskable = square.replace('<g ', '<g transform="translate(51.2 51.2) scale(0.8)" ').replace(/<circle cx="(\d+)" cy="(\d+)"/g, (_m, x, y) => `<circle cx="${51.2 + x * 0.8}" cy="${51.2 + y * 0.8}"`).replace(/r="36"/g, 'r="28.8"');

const png = (s, size) => sharp(Buffer.from(s), { density: 384 }).resize(size, size).png().toBuffer();
const pub = `${root}apps/web/public/`;
writeFileSync(`${pub}icon-192.png`, await png(svg, 192));
writeFileSync(`${pub}icon-512.png`, await png(svg, 512));
writeFileSync(`${pub}icon-maskable-512.png`, await png(maskable, 512));
writeFileSync(`${pub}apple-touch-icon.png`, await png(square, 180));
mkdirSync(`${root}apps/mobile/assets`, { recursive: true });
writeFileSync(`${root}apps/mobile/assets/icon-only.png`, await png(square, 1024));
writeFileSync(`${root}apps/mobile/assets/icon-foreground.png`, await png(maskable.replace(/<rect[^>]*\/>/, ''), 1024));
writeFileSync(`${root}apps/mobile/assets/icon-background.png`, await sharp({ create: { width: 1024, height: 1024, channels: 4, background: brand } }).png().toBuffer());
const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="#F9FAFD"/><g transform="translate(1110 1110) scale(1)">${svg.replace(/<\/?svg[^>]*>/g, '')}</g></svg>`;
writeFileSync(`${root}apps/mobile/assets/splash.png`, await sharp(Buffer.from(splash)).png().toBuffer());
const splashDark = splash.replace('#F9FAFD', '#14161C');
writeFileSync(`${root}apps/mobile/assets/splash-dark.png`, await sharp(Buffer.from(splashDark)).png().toBuffer());
writeFileSync(`${root}apps/desktop/src-tauri/app-icon.png`, await png(svg, 1024));
console.log('icons generated with brand', brand);
