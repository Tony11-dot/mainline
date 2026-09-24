import { formatEval, winningChances, type EvalLine } from '@mainline/shared';

/** White-share gauge. Vertical beside the board on desktop, horizontal above it on phones. */
export function EvalBar({ line, orientation, direction = 'vertical', className = '' }: { line?: EvalLine; orientation: 'white' | 'black'; direction?: 'vertical' | 'horizontal'; className?: string }) {
  const wc = line ? winningChances(line) : 0;
  const whitePct = 50 + wc * 50;
  const flipped = orientation === 'black';
  const label = formatEval(line);
  const vertical = direction === 'vertical';
  const whiteSide = flipped ? 'start' : 'end';
  return (
    <div
      className={`relative overflow-hidden rounded-[6px] bg-[oklch(0.3_0.01_262)] ring-1 ring-line-strong ${vertical ? 'w-3' : 'h-1.5'} ${className}`}
      role="meter"
      aria-label="Evaluation"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(whitePct)}
      aria-valuetext={line ? label : 'No evaluation'}
    >
      <div
        className="absolute bg-[oklch(0.97_0.004_262)] transition-[height,width] duration-500 ease-[var(--ease-out)]"
        style={
          vertical
            ? { left: 0, right: 0, height: `${whitePct}%`, [whiteSide === 'end' ? 'bottom' : 'top']: 0 }
            : { top: 0, bottom: 0, width: `${whitePct}%`, [flipped ? 'right' : 'left']: 0 }
        }
      />
      {vertical && <div className="absolute inset-x-0 top-1/2 h-px bg-[oklch(0.6_0.02_262/0.6)]" />}
    </div>
  );
}
