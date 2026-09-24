import { useNavigate } from 'react-router';
import { uciToSan, positionFromFen, epdToFen, type Conflict } from '@mainline/shared';
import { useLibrary } from '../../lib/library';
import { Sheet } from '../../ui/Sheet';
import { MiniBoard } from '../../ui/MiniBoard';

export function ConflictsSheet({ open, conflicts, onClose }: { open: boolean; conflicts: Conflict[]; onClose: () => void }) {
  const lib = useLibrary();
  const nav = useNavigate();
  return (
    <Sheet open={open} onClose={onClose} title="Conflicting moves" wide>
      <p className="text-sm text-ink-2">In each position below, two of your repertoires play different moves. Open one and make your choice the main move (or delete the other).</p>
      <ul className="mt-3 flex flex-col divide-y divide-line">
        {conflicts.map((c) => (
          <li key={c.epd} className="flex gap-3 py-3">
            <MiniBoard fen={c.epd} size={84} orientation={c.color} />
            <div className="min-w-0 flex-1">
              {[...c.choices].map(([uci, repIds]) => (
                <div key={uci} className="mb-1.5">
                  <span className="font-bold">{uciToSan(positionFromFen(epdToFen(c.epd)), uci)}</span>
                  <span className="text-sm text-ink-2"> in </span>
                  {repIds.map((id) => {
                    const r = lib.reps.find((x) => x.id === id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className="mr-1 text-sm font-semibold text-brand hover:underline"
                        onClick={() => {
                          onClose();
                          nav(`/rep/${id}?at=${encodeURIComponent(c.epd)}`);
                        }}
                      >
                        {r?.name}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
