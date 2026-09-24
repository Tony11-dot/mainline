import { useRef, useState } from 'react';
import { Crosshair, PieChart, Plus } from 'lucide-react';
import { epdToFen, plyFromFen, positionFromFen, uciToSan, type CoverageResult, type Repertoire } from '@mainline/shared';
import { computeCoverage, computeRadar, type Progress, type RadarItem } from '../lib/insights';
import { repMoves, useLibrary } from '../lib/library';
import { usePrefs } from '../lib/prefs';
import { ApiError } from '../lib/api';
import { Button, Segmented } from '../ui/primitives';
import { toast } from '../ui/toast';
import { CoachAnswer } from './CoachPanel';

/** Coverage + gaps and the mistake radar for one repertoire. */
export function InsightsPanel({ rep, onOpen }: { rep: Repertoire; onOpen: (epd: string) => void }) {
  const [tab, setTab] = useState<'coverage' | 'radar'>('coverage');
  return (
    <div className="p-3.5">
      <Segmented
        label="Insights"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'coverage', label: 'Coverage' },
          { value: 'radar', label: 'Mistake radar' },
        ]}
      />
      <div className="mt-3">{tab === 'coverage' ? <Coverage rep={rep} onOpen={onOpen} /> : <Radar rep={rep} onOpen={onOpen} />}</div>
    </div>
  );
}

function useRun<T>() {
  const [state, setState] = useState<{ running: boolean; progress?: Progress; result?: T; error?: string }>({ running: false });
  const ctrl = useRef<AbortController | null>(null);
  const run = async (fn: (signal: AbortSignal, onProgress: (p: Progress) => void) => Promise<T>) => {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setState({ running: true });
    try {
      const result = await fn(ctrl.current.signal, (progress) => setState((s) => ({ ...s, progress })));
      setState({ running: false, result });
    } catch (e) {
      setState({ running: false, error: e instanceof ApiError ? e.message : String(e) });
    }
  };
  return { state, run, stop: () => ctrl.current?.abort() };
}

function ProgressBar({ p }: { p?: Progress }) {
  return (
    <div className="mt-3" role="status">
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${p && p.total ? (p.done / p.total) * 100 : 5}%` }} />
      </div>
      <p className="tnum mt-1 text-xs text-ink-3">{p ? `${p.done} of ${p.total} positions (one Lichess request at a time)` : 'Starting…'}</p>
    </div>
  );
}

function Coverage({ rep, onOpen }: { rep: Repertoire; onOpen: (epd: string) => void }) {
  const lib = useLibrary();
  const { rating, speeds } = usePrefs();
  const [depth, setDepth] = useState('20');
  const { state, run, stop } = useRun<CoverageResult>();
  const moves = repMoves(lib.moves, rep.id);
  const res = state.result;
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-2">Through move</span>
        <Segmented label="Depth" value={depth} onChange={setDepth} options={['10', '16', '20', '30'].map((v) => ({ value: v, label: String(Math.ceil(Number(v) / 2)) }))} className="w-48" />
        {state.running ? (
          <Button size="sm" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon={PieChart} onClick={() => void run((s, p) => computeCoverage(rep, moves, Number(depth), s, p))}>
            {res ? 'Recalculate' : 'Calculate'}
          </Button>
        )}
      </div>
      {state.running && <ProgressBar p={state.progress} />}
      {state.error && <p className="mt-3 text-sm text-bad">{state.error}</p>}
      {res && !state.running && (
        <div className="mt-4">
          <p className="text-lg font-bold">
            Handles <span className="text-brand-ink">{pct(res.covered)}</span> of games at {rating} {speeds.join('/')} through move {Math.ceil(Number(depth) / 2)}
          </p>
          {res.missing.length > 0 && <p className="text-xs text-ink-3">{res.missing.length} positions had no explorer data and were split evenly.</p>}
          {res.gaps.length > 0 && (
            <>
              <h3 className="mt-4 mb-1.5 text-sm font-semibold text-ink-2">Biggest gaps</h3>
              <ul className="divide-y divide-line rounded-[12px] border border-line">
                {res.gaps.slice(0, 12).map((g) => (
                  <li key={g.epd + g.uci} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="tnum w-12 shrink-0 font-bold">{pct(g.reach)}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block">
                        {Math.floor(plyFromFen(epdToFen(g.epd)) / 2) + 1}
                        {plyFromFen(epdToFen(g.epd)) % 2 ? '…' : '.'} {g.san}
                      </b>
                      <span className="block truncate text-xs text-ink-3">
                        {Math.round(g.share * 100)}% of games there · {g.games.toLocaleString()} games
                      </span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => onOpen(g.epd)}>
                      Open
                    </Button>
                    <Button size="sm" icon={Plus} onClick={() => void lib.addMove(rep.id, epdToFen(g.epd), g.uci).then(() => toast(`Added ${g.san} — now choose your reply`, { kind: 'success' }))}>
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {res.undecided.length > 0 && <p className="mt-3 text-sm text-warn">{res.undecided.length} position{res.undecided.length > 1 ? 's' : ''} where it's your move but nothing is prepared.</p>}
        </div>
      )}
    </div>
  );
}

function Radar({ rep, onOpen }: { rep: Repertoire; onOpen: (epd: string) => void }) {
  const lib = useLibrary();
  const { state, run, stop } = useRun<RadarItem[]>();
  const [open, setOpen] = useState<string | null>(null);
  const moves = repMoves(lib.moves, rep.id);
  const add = async (r: RadarItem) => {
    await lib.addMove(rep.id, epdToFen(r.epd), r.uci);
    if (r.refutation) await lib.addMove(rep.id, r.afterFen, r.refutation);
    toast(`Added ${r.san} and its refutation — it will come up in training`, { kind: 'success' });
  };
  return (
    <div>
      <p className="text-sm text-ink-2">Popular opponent replies (≥ 5% at your level) that lose at least a pawn according to the engine — know how to punish them.</p>
      <div className="mt-2">
        {state.running ? (
          <Button size="sm" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon={Crosshair} onClick={() => void run((s, p) => computeRadar(rep, moves, s, p))}>
            {state.result ? 'Scan again' : 'Scan repertoire'}
          </Button>
        )}
      </div>
      {state.running && <ProgressBar p={state.progress} />}
      {state.result && !state.running && (
        <ul className="mt-3 flex flex-col gap-2">
          {state.result.length === 0 && <li className="text-sm text-ink-2">No common mistakes found (only positions with cloud evaluations are checked).</li>}
          {state.result.map((r) => {
            const pos = positionFromFen(r.afterFen);
            const ref = r.refutation ? uciToSan(pos, r.refutation) : undefined;
            const key = r.epd + r.uci;
            return (
              <li key={key} className="rounded-[12px] border border-line p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex-1">
                    <b>{r.san}</b> <span className="text-ink-2">({Math.round(r.share * 100)}% · −{r.drop.toFixed(1)})</span>
                    {ref && (
                      <>
                        {' '}
                        → punish with <b className="text-good">{ref}</b>
                      </>
                    )}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setOpen(open === key ? null : key)}>
                    Why?
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onOpen(r.epd)}>
                    Open
                  </Button>
                  {!r.inRepertoire && (
                    <Button size="sm" icon={Plus} onClick={() => void add(r)}>
                      Add
                    </Button>
                  )}
                </div>
                {open === key && r.refutation && (
                  <div className="mt-2 border-t border-line pt-2">
                    <CoachAnswer req={{ kind: 'punish', fen: r.afterFen, moveUci: r.refutation }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
