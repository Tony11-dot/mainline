// Derives every brand asset from brand/ (the owner's originals):
//   brand/app-icon.png              → PWA/iOS/Android/desktop app icons
//   brand/mark.png                  → in-app knight mark (tinted to the theme via CSS mask), splash
//   brand/wordmark.png              → "MainLine" lockup
//   brand/launch-animation.source.json → public/launch.json with the Jitter watermark removed
// Usage: node scripts/brand.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const B = (f) => `${root}brand/${f}`;
const pub = `${root}apps/web/public/`;
mkdirSync(`${pub}brand`, { recursive: true });
mkdirSync(`${root}apps/mobile/assets`, { recursive: true });

export const BRAND = '#072EB8'; // sampled from the icon's blue field
const BG_LIGHT = '#F9FAFD';
const BG_DARK = '#14161C';

const icon = sharp(B('app-icon.png'));
const png = async (img, size, file) => writeFileSync(file, await img.clone().resize(size, size).png().toBuffer());

// --- App icons -----------------------------------------------------------------
await png(icon, 192, `${pub}icon-192.png`);
await png(icon, 512, `${pub}icon-512.png`);
await png(icon, 512, `${pub}icon-maskable-512.png`); // artwork already sits inside the 80% safe zone
await png(icon, 180, `${pub}apple-touch-icon.png`);
await png(icon, 32, `${pub}favicon-32.png`);
await png(icon, 1024, `${root}apps/mobile/assets/icon-only.png`);
await png(icon, 1024, `${root}apps/desktop/src-tauri/app-icon.png`);

// --- In-app mark (trimmed, alpha kept; recoloured with CSS masks) ------------------
const markTrim = await sharp(B('mark.png')).trim().toBuffer();
writeFileSync(`${pub}brand/mark.png`, await sharp(markTrim).resize({ height: 512 }).png().toBuffer());
writeFileSync(`${pub}brand/wordmark.png`, await sharp(B('wordmark.png')).trim().resize({ height: 160 }).png().toBuffer());

// A pure-white knight for dark backgrounds (Android adaptive foreground, dark splash)
const whiteKnight = async (h) => {
  const m = await sharp(markTrim).resize({ height: h }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const d = m.data;
  for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255;
  return sharp(d, { raw: m.info }).png().toBuffer();
};
const tinted = async (h, hex) => {
  const m = await sharp(markTrim).resize({ height: h }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const d = m.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  return sharp(d, { raw: m.info }).png().toBuffer();
};

// Android adaptive icon: white knight inside the 66% safe zone over the brand gradient.
const fg = await whiteKnight(560);
writeFileSync(
  `${root}apps/mobile/assets/icon-foreground.png`,
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fg, gravity: 'center' }])
    .png()
    .toBuffer(),
);
const gradient = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2962F4"/><stop offset="0.45" stop-color="${BRAND}"/><stop offset="1" stop-color="#0423A2"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/></svg>`;
writeFileSync(`${root}apps/mobile/assets/icon-background.png`, await sharp(Buffer.from(gradient)).png().toBuffer());

// Native splash (shown before the web view paints; the web launch animation continues seamlessly).
const splash = async (bg, knight) =>
  sharp({ create: { width: 2732, height: 2732, channels: 4, background: bg } })
    .composite([{ input: knight, gravity: 'center' }])
    .png()
    .toBuffer();
writeFileSync(`${root}apps/mobile/assets/splash.png`, await splash(BG_LIGHT, await tinted(420, BRAND)));
writeFileSync(`${root}apps/mobile/assets/splash-dark.png`, await splash(BG_DARK, await tinted(420, '#8FA8FF')));

// Android notification small icon: white knight silhouette (Android tints it), per density.
for (const [dpi, size] of [['mdpi', 24], ['hdpi', 36], ['xhdpi', 48], ['xxhdpi', 72], ['xxxhdpi', 96]]) {
  const dir = `${root}apps/mobile/android/app/src/main/res/drawable-${dpi}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/ic_stat_mainline.png`,
    await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await whiteKnight(Math.round(size * 0.9)), gravity: 'center' }])
      .png()
      .toBuffer(),
  );
}

// --- Launch animation: strip the Jitter free-tier watermark --------------------------
const anim = JSON.parse(readFileSync(B('launch-animation.source.json'), 'utf8'));
writeFileSync(`${pub}launch.json`, JSON.stringify(stripJitterWatermark(anim)));

/**
 * Jitter's free export bakes "jitter.video" into the composition as outlined vector letterforms: a
 * precomp layer parented to a static null pinned near the bottom-right corner. It's paths, not text or
 * an image, so it doesn't show up by name. We remove that null, the layers parented to it, and the
 * precomp assets they (exclusively) reference. Everything else is left untouched.
 */
export function stripJitterWatermark(doc) {
  const d = structuredClone(doc);
  const isStaticCornerNull = (l) => {
    if (l.ty !== 3) return false;
    const k = l.ks?.p?.k;
    return Array.isArray(k) && typeof k[0] === 'number' && k[0] > d.w * 0.75 && k[1] > d.h * 0.8;
  };
  const nulls = d.layers.filter(isStaticCornerNull).filter((n) => d.layers.some((l) => l.parent === n.ind && l.ty === 0));
  if (nulls.length !== 1) throw new Error(`expected exactly one watermark anchor, found ${nulls.length}`);
  const anchor = nulls[0];
  const children = d.layers.filter((l) => l.parent === anchor.ind);
  const assetIds = new Set();
  const collect = (id) => {
    if (assetIds.has(id)) return;
    assetIds.add(id);
    for (const l of d.assets.find((a) => a.id === id)?.layers ?? []) if (l.refId) collect(l.refId);
  };
  for (const c of children) if (c.refId) collect(c.refId);
  // Only remove assets nothing else uses.
  const keptLayers = d.layers.filter((l) => l !== anchor && !children.includes(l));
  const stillUsed = JSON.stringify([keptLayers, d.assets.filter((a) => !assetIds.has(a.id))]);
  for (const id of assetIds) if (stillUsed.includes(`"refId":"${id}"`)) assetIds.delete(id);
  d.layers = keptLayers;
  d.assets = d.assets.filter((a) => !assetIds.has(a.id));
  return d;
}

console.log('brand assets generated');
