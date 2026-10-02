import { Cpu, Cloud } from 'lucide-react';
import { formatEval, plyFromFen, uciLineToSan, type EvalLine } from '@mainline/shared';
import { engine } from '../lib/engine';
import { usePrefs } from '../lib/prefs';
import type { EngineView } from './useEngineEval';
import { t, tn } from '../lib/i18n';

export function EnginePanel({ fen, view, onPlayLine, onHoverMove }: { fen: string; view: EngineView; onPlayLine: (ucis: string[]) => void; onHoverMove?: (uci: string | null) => void }) {
  const { engineOn, set } = usePrefs();
  const best = view.lines[0];
  const flavor = engine.info;
  return (
    <section aria-label={t('Engine')} className="px-1">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <label className="relative inline-flex cursor-pointer items-center">
          <input type="checkbox" className="peer sr-only" checked={engineOn} onChange={(e) => set({ engineOn: e.target.checked })} aria-label={t('Engine analysis')} />
          <span className="h-[26px] w-[44px] rounded-full bg-surface-3 transition-colors duration-200 peer-checked:bg-brand" />
          <span className="absolute start-[3px] top-[3px] size-5 rounded-full bg-white shadow-1 transition-transform duration-200 ease-[var(--ease-out)] peer-checked:translate-x-[18px] rtl:peer-checked:-translate-x-[18px]" />
        </label>
        <div className="tnum min-w-[4.5ch] text-xl font-bold tracking-tight">{engineOn ? formatEval(best) : '—'}</div>
        <div className="ms-auto flex items-center gap-1.5 text-xs text-ink-3">
          {engineOn && view.source === 'cloud' && <Cloud size={13} aria-hidden />}
          {engineOn && view.source === 'local' && <Cpu size={13} aria-hidden />}
          {engineOn ? (
            <span className="tnum">
              {view.source === 'cloud' ? t('Cloud') : `Stockfish 19${flavor.threaded ? ` · ${tn(flavor.threads, '{n} thread', '{n} threads')}` : ''}`}
              {view.depth ? ` · ${t('depth {n}', { n: view.depth })}` : ''}
              {view.searching && <span className="ms-1 inline-block size-1.5 animate-pulse rounded-full bg-brand align-middle" />}
            </span>
          ) : (
            t('Engine off')
          )}
        </div>
      </div>
      {engineOn && (
        <ol dir="ltr" className="flex flex-col">
          {(view.lines.length ? view.lines : [undefined, undefined, undefined]).map((line, i) => (
            <PvRow key={i} fen={fen} line={line} onPlayLine={onPlayLine} onHoverMove={onHoverMove} />
          ))}
        </ol>
      )}
    </section>
  );
}

function PvRow({ fen, line, onPlayLine, onHoverMove }: { fen: string; line?: EvalLine; onPlayLine: (u: string[]) => void; onHoverMove?: (uci: string | null) => void }) {
  if (!line) return <li className="mx-3 my-1.5 h-5 animate-pulse rounded bg-surface-3" aria-hidden />;
  const sans = uciLineToSan(fen, line.moves.slice(0, 12));
  const ply0 = plyFromFen(fen);
  const positive = line.mate !== undefined ? line.mate > 0 : (line.cp ?? 0) >= 0;
  return (
    <li
      className="flex items-baseline gap-2 border-t border-line px-3 py-1.5 text-sm first:border-t-0"
      onMouseEnter={() => onHoverMove?.(line.moves[0] ?? null)}
      onMouseLeave={() => onHoverMove?.(null)}
    >
      <span className={`tnum w-[5.2ch] shrink-0 rounded-[6px] px-1 py-px text-center text-xs font-bold ${positive ? 'bg-[oklch(0.97_0.004_262)] text-[oklch(0.25_0.02_262)] ring-1 ring-line' : 'bg-[oklch(0.3_0.015_262)] text-white'}`}>
        {formatEval(line)}
      </span>
      <span className="min-w-0 truncate text-ink-2">
        {sans.map((san, j) => {
          const ply = ply0 + j;
          const num = ply % 2 === 0 ? `${Math.floor(ply / 2) + 1}.` : j === 0 ? `${Math.floor(ply / 2) + 1}…` : '';
          return (
            <button
              key={j}
              type="button"
              className="rounded px-0.5 hover:bg-brand-soft hover:text-brand-ink"
              onClick={() => onPlayLine(line.moves.slice(0, j + 1))}
            >
              {num && <span className="text-ink-3">{num}</span>}
              <span className={j === 0 ? 'font-semibold text-ink' : ''}>{san}</span>
            </button>
          );
        })}
      </span>
    </li>
  );
}
