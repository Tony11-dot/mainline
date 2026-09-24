import { createElement, memo } from 'react';
import { parseFen } from 'chessops/fen';

/** Static, cheap board for lists and previews (no chessground instance). */
export const MiniBoard = memo(function MiniBoard({ fen, orientation = 'white', size = 120, lastMove, className = '' }: { fen: string; orientation?: 'white' | 'black'; size?: number; lastMove?: string; className?: string }) {
  const setup = parseFen(fen.split(' ').length === 4 ? `${fen} 0 1` : fen);
  if (setup.isErr) return null;
  const board = setup.unwrap().board;
  const pieces: React.ReactNode[] = [];
  const pos = (sq: number) => {
    const file = sq % 8;
    const rank = Math.floor(sq / 8);
    const col = orientation === 'white' ? file : 7 - file;
    const row = orientation === 'white' ? 7 - rank : rank;
    return { left: `${col * 12.5}%`, top: `${row * 12.5}%` };
  };
  for (const [sq, piece] of board) {
    pieces.push(createElement('piece', { key: sq, className: `${piece.color} ${piece.role}`, style: { ...pos(sq), width: '12.5%', height: '12.5%' } }));
  }
  const hl = lastMove
    ? [lastMove.slice(0, 2), lastMove.slice(2, 4)].map((s) => {
        const sq = s.charCodeAt(0) - 97 + 8 * (Number(s[1]) - 1);
        return <div key={s} className="absolute" style={{ ...pos(sq), width: '12.5%', height: '12.5%', background: 'var(--sq-last)' }} />;
      })
    : null;
  return (
    <div
      className={`ml-mini cg-wrap relative shrink-0 overflow-hidden rounded-[8px] shadow-1 ${className}`}
      style={{ width: size, height: size, backgroundImage: 'repeating-conic-gradient(var(--sq-dark) 0 25%, var(--sq-light) 0 50%)', backgroundSize: '25% 25%' }}
      role="img"
      aria-label="Chess position"
    >
      {hl}
      {pieces}
    </div>
  );
});
