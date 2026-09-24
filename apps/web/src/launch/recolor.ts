/**
 * Recolours a Lottie document to the active theme — the same approach as ClassMate's splash
 * (`_recolor` + `_tintEmbeddedImages`): baked fills/strokes matching a source colour (±0.03 per
 * channel) are replaced, and base64 raster assets are tinted keeping their alpha (srcIn).
 */
type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '').trim();
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function recolor(node: unknown, from: Rgb, to: Rgb, tolerance = 0.03): number {
  let n = 0;
  const walk = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== 'object') return;
    const o = x as Record<string, unknown>;
    if ((o.ty === 'fl' || o.ty === 'st') && o.c && typeof o.c === 'object') {
      const k = (o.c as { k?: unknown }).k;
      if (Array.isArray(k) && k.length >= 3 && k.slice(0, 3).every((v, i) => typeof v === 'number' && Math.abs(v - from[i]!) <= tolerance)) {
        (o.c as { k: unknown[] }).k = [to[0], to[1], to[2], ...(k.length > 3 ? [k[3]] : [])];
        n++;
      }
    }
    Object.values(o).forEach(walk);
  };
  walk(node);
  return n;
}

/** Tints every embedded data-URI image to `hex`, preserving alpha. */
export async function tintEmbeddedImages(doc: { assets?: { p?: string }[] }, hex: string): Promise<void> {
  for (const asset of doc.assets ?? []) {
    if (!asset.p?.startsWith('data:image')) continue;
    try {
      const img = new Image();
      img.src = asset.p;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, c.width, c.height);
      asset.p = c.toDataURL('image/png');
    } catch {
      /* leave this asset as shipped */
    }
  }
}

/** Colours baked into the MainLine export (sampled from brand/launch-animation.source.json). */
export const BAKED = {
  wordmark: [0.114, 0.157, 0.573] as Rgb,
  // ClassMate exports' blues, in case a future export reuses them.
  navy: [0.047, 0.098, 0.576] as Rgb,
  brandBlue: [0.059, 0.169, 0.714] as Rgb,
  canvas: [1, 1, 1] as Rgb,
};
