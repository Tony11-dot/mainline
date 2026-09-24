import { memo } from 'react';

const GLYPHS = ['♞', '♜', '♝', '♛', '♚', '♟', '♘', '♖', '♗', '♕'];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

interface Item {
  kind: 'glyph' | 'ring' | 'dot' | 'blob' | 'curve';
  x: number;
  y: number;
  size: number;
  rot: number;
  opacity: number;
  dur: number;
  delay: number;
  glyph?: string;
  dx: number;
  dy: number;
}

/** Deterministic layout that keeps the centre band (where the animation plays) clear. */
function layout(seed: number, density: number): Item[] {
  const r = rng(seed);
  const items: Item[] = [];
  const count = Math.round(26 * density);
  const kinds: Item['kind'][] = ['glyph', 'glyph', 'glyph', 'ring', 'dot', 'dot', 'curve', 'blob'];
  for (let i = 0; i < count; i++) {
    let x = r() * 100;
    let y = r() * 100;
    // Push items out of the middle 60% × 34% so the logo stays clean.
    if (x > 20 && x < 80 && y > 33 && y < 67) y = y < 50 ? y - 22 : y + 22;
    x = Math.max(-4, Math.min(100, x));
    const kind = kinds[Math.floor(r() * kinds.length)]!;
    items.push({
      kind,
      x,
      y,
      size: kind === 'blob' ? 140 + r() * 160 : kind === 'dot' ? 4 + r() * 6 : kind === 'ring' ? 18 + r() * 26 : kind === 'curve' ? 70 + r() * 70 : 18 + r() * 22,
      rot: r() * 360,
      opacity: kind === 'blob' ? 0.1 : kind === 'dot' ? 0.28 : 0.14 + r() * 0.1,
      dur: 9 + r() * 9,
      delay: -r() * 10,
      glyph: GLYPHS[Math.floor(r() * GLYPHS.length)],
      dx: (r() - 0.5) * 26,
      dy: (r() - 0.5) * 26,
    });
  }
  return items;
}

export const AmbientBackground = memo(function AmbientBackground({ animate = true, seed = 3, density = 1.1 }: { animate?: boolean; seed?: number; density?: number }) {
  const items = layout(seed, density);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden text-brand" aria-hidden>
      {items.map((it, i) => {
        const style: React.CSSProperties = {
          left: `${it.x}%`,
          top: `${it.y}%`,
          opacity: it.opacity,
          ['--dx' as string]: `${it.dx}px`,
          ['--dy' as string]: `${it.dy}px`,
          ['--rot' as string]: `${it.rot}deg`,
          animation: animate ? `ml-drift ${it.dur}s ease-in-out ${it.delay}s infinite alternate` : undefined,
          transform: `translate(-50%, -50%) rotate(${it.rot}deg)`,
        };
        if (it.kind === 'glyph')
          return (
            <span key={i} className="absolute leading-none" style={{ ...style, fontSize: it.size, fontFamily: 'system-ui, sans-serif' }}>
              {it.glyph}
            </span>
          );
        if (it.kind === 'ring') return <span key={i} className="absolute rounded-full border-2 border-current" style={{ ...style, width: it.size, height: it.size }} />;
        if (it.kind === 'dot') return <span key={i} className="absolute rounded-full bg-current" style={{ ...style, width: it.size, height: it.size }} />;
        if (it.kind === 'blob')
          return <span key={i} className="absolute rounded-full bg-current blur-3xl" style={{ ...style, width: it.size, height: it.size }} />;
        return (
          <svg key={i} className="absolute" style={{ ...style, width: it.size, height: it.size * 0.6 }} viewBox="0 0 100 60" fill="none">
            <path d="M4 54 C 26 50, 38 36, 50 26 S 76 8, 96 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        );
      })}
    </div>
  );
});
