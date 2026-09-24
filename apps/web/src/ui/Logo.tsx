/**
 * The MainLine knight and wordmark, drawn as CSS masks filled with the theme accent — so the logo
 * follows whichever theme is active (the source art is the owner's blue-on-transparent PNGs).
 */
const MARK_RATIO = 752 / 1002; // trimmed knight, width / height
const WORD_RATIO = 592 / 160; // trimmed wordmark at 160px tall

export function LogoMark({ size = 28, color = 'var(--brand)', className = '' }: { size?: number; color?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${className}`}
      style={{
        height: size,
        width: Math.round(size * MARK_RATIO),
        backgroundColor: color,
        WebkitMaskImage: 'url(/brand/mark.png)',
        maskImage: 'url(/brand/mark.png)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}

export function Wordmark({ height = 28, color = 'var(--brand)', className = '' }: { height?: number; color?: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label="MainLine"
      className={`inline-block shrink-0 ${className}`}
      style={{
        height,
        width: Math.round(height * WORD_RATIO),
        backgroundColor: color,
        WebkitMaskImage: 'url(/brand/wordmark.png)',
        maskImage: 'url(/brand/wordmark.png)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
      }}
    />
  );
}
