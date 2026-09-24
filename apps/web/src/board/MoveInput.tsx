import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { playUci, positionFromFen, sanToUci } from '@mainline/shared';

/**
 * Keyboard move entry for accessibility and speed: type SAN ("Nf3", "exd5", "O-O") or UCI ("g1f3")
 * and press Enter. "/" focuses it from anywhere.
 */
export function MoveInput({ fen, onMove, disabled }: { fen: string; onMove: (uci: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const submit = () => {
    const text = value.trim().replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O');
    if (!text) return;
    const pos = positionFromFen(fen);
    let uci = sanToUci(pos, text);
    if (!uci && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(text)) {
      try {
        uci = playUci(pos, text).uci;
      } catch {
        uci = undefined;
      }
    }
    if (!uci) {
      setError(true);
      return;
    }
    setValue('');
    setError(false);
    onMove(uci);
  };
  return (
    <label className="relative flex items-center">
      <Keyboard size={16} className="pointer-events-none absolute left-2.5 text-ink-3" aria-hidden />
      <input
        ref={ref}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value);
          setError(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
          e.stopPropagation(); // arrow keys edit the text, not the board
        }}
        placeholder="Type a move (/)"
        aria-label="Type a move in algebraic notation, then press Enter"
        aria-invalid={error}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={`h-9 w-40 rounded-[10px] border bg-surface pl-8 pr-2 text-sm outline-none transition-colors focus:border-brand focus:ring-3 focus:ring-brand/20 ${error ? 'border-bad' : 'border-line'}`}
      />
    </label>
  );
}
