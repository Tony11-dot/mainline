import { createElement, useEffect } from 'react';

export type PromotionRole = 'queen' | 'knight' | 'rook' | 'bishop';
const ROLES: PromotionRole[] = ['queen', 'knight', 'rook', 'bishop'];

/** Lichess-style picker: the four pieces stacked on the promotion file, from the promotion square inward. */
export function PromotionPicker(props: { color: 'white' | 'black'; file: number; orientation: 'white' | 'black'; onPick: (r: PromotionRole | null) => void }) {
  const { color, file, orientation, onPick } = props;
  const col = orientation === 'white' ? file : 7 - file;
  const fromTop = (color === 'white') === (orientation === 'white');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onPick(null);
      const map: Record<string, PromotionRole> = { q: 'queen', n: 'knight', r: 'rook', b: 'bishop' };
      if (map[e.key.toLowerCase()]) onPick(map[e.key.toLowerCase()]!);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPick]);

  return (
    <div
      className="absolute inset-0 z-[var(--z-board-overlay)] bg-[oklch(0.2_0.02_262/0.45)] backdrop-blur-[2px] animate-[fade-in_120ms_ease-out]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onPick(null);
      }}
      role="dialog"
      aria-label="Choose promotion piece"
    >
      <div className="cg-wrap pointer-events-none" style={{ width: '100%', height: '100%' }}>
      {ROLES.map((role, i) => {
        const row = fromTop ? i : 7 - i;
        return (
          <button
            key={role}
            type="button"
            aria-label={`Promote to ${role}`}
            className="promo-choice pointer-events-auto absolute flex items-center justify-center"
            style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%`, width: '12.5%', height: '12.5%' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onPick(role);
            }}
          >
            {createElement('piece', { className: `${role} ${color}` })}
          </button>
        );
      })}
      </div>
    </div>
  );
}
