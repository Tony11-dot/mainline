import { useEffect, useRef, useState } from 'react';
import { BAKED, hexToRgb, recolor, tintEmbeddedImages } from './recolor';
import { AmbientBackground } from './AmbientBackground';

type LottiePlayer = typeof import('lottie-web').default;

/**
 * The launch animation, staged like ClassMate's splash: the theme's surface, a soft ambient wash of
 * drifting chess glyphs fading in (1.1 s, easeOutCubic), and the Jitter scene (watermark stripped at
 * build time by scripts/brand.mjs) recoloured to the theme and played once with aspect-fit. Then a
 * short fade to the app. It can never trap the user: tap/Escape skips, and a safety timer hands off
 * even if the player never reports completion.
 */
export function LaunchScreen({ onDone }: { onDone: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [decorIn, setDecorIn] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);
  const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    setTimeout(onDone, reduceMotion ? 120 : 360);
  };

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDecorIn(true));
    let anim: { destroy(): void } | undefined;
    let safety: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    (async () => {
      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue('--theme-accent-hex').trim() || '#072EB8';
      const surface = css.getPropertyValue('--theme-surface-hex').trim() || '#F9FAFD';
      let doc: { op: number; fr: number; assets?: { p?: string }[] };
      try {
        doc = await (await fetch('/launch.json')).json();
      } catch {
        finish();
        return;
      }
      const a = hexToRgb(accent);
      recolor(doc, BAKED.canvas, hexToRgb(surface));
      recolor(doc, BAKED.wordmark, a);
      recolor(doc, BAKED.navy, a);
      recolor(doc, BAKED.brandBlue, a);
      await tintEmbeddedImages(doc, accent);
      const lottie = ((await import('lottie-web/build/player/lottie_light')) as unknown as { default: LottiePlayer }).default;
      if (cancelled || !host.current) return;
      const durationMs = (doc.op / doc.fr) * 1000;
      safety = setTimeout(finish, durationMs + 1200);
      const item = lottie.loadAnimation({
        container: host.current,
        renderer: 'svg',
        loop: false,
        autoplay: !reduceMotion,
        animationData: doc,
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet', progressiveLoad: false },
      });
      anim = item;
      if (reduceMotion) {
        item.addEventListener('DOMLoaded', () => item.goToAndStop(doc.op - 1, true));
        safety = setTimeout(finish, 700);
      } else {
        item.addEventListener('complete', finish);
        item.addEventListener('data_failed', finish);
      }
    })();

    const skip = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    window.addEventListener('keydown', skip);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(safety);
      window.removeEventListener('keydown', skip);
      anim?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[var(--z-tooltip)] flex items-center justify-center overflow-hidden bg-bg"
      style={{ opacity: leaving ? 0 : 1, transition: `opacity ${reduceMotion ? 100 : 340}ms cubic-bezier(0.4, 0, 1, 1)` }}
      onPointerDown={finish}
      role="img"
      aria-label="MainLine"
      data-testid="launch-screen"
    >
      <div className="absolute inset-0" style={{ opacity: decorIn ? 1 : 0, transition: 'opacity 1100ms cubic-bezier(0.33, 1, 0.68, 1)' }}>
        <AmbientBackground animate={!reduceMotion} />
      </div>
      {/* The 16:9 scene's artwork sits in its middle ~40%: on portrait screens zoom into the empty margins. */}
      <div ref={host} className="relative aspect-video w-full max-w-[min(100vw,177.78dvh)] portrait:scale-[1.7]" />
    </div>
  );
}

/** Native apps and installed PWAs play it on every launch; a browser tab once per session. */
export function shouldShowLaunch(isNative: boolean): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(location.search);
  if (params.has('launch')) return true;
  if (navigator.webdriver) return false; // automated tests
  if (isNative || matchMedia('(display-mode: standalone)').matches) return true;
  try {
    if (sessionStorage.getItem('ml.launched')) return false;
    sessionStorage.setItem('ml.launched', '1');
  } catch {
    return false;
  }
  return true;
}
