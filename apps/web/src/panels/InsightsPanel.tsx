import { useRef, useState } from 'react';
import { Crosshair, PieChart, Plus } from 'lucide-react';
import { epdToFen, plyFromFen, positionFromFen, uciToSan, type CoverageResult, type Repertoire } from '@mainline/shared';
import { computeCoverage, computeRadar, type Progress, type RadarItem } from '../lib/insights';
import { repMoves, useLibrary } from '../lib/library';
import { usePrefs } from '../lib/prefs';
import { ApiError } from '../lib/api';
import { Button, Segmented } from '../ui/primitives';
import { toast } from '../ui/toast';
import { speedName } from '../lib/speeds';
import { CoachAnswer } from './CoachPanel';
import { fmtPercent, intlLocale, t, tn, tx } from '../lib/i18n';

/** Coverage + gaps and the mistake radar for one repertoire. */
export function InsightsPanel({ rep, onOpen }: { rep: Repertoire; onOpen: (epd: string) => void }) {
  const [tab, setTab] = useState<'coverage' | 'radar'>('coverage');
  return (
    <div className="p-4">
      <Segmented
        label={t('Insights')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'coverage', label: t('Coverage') },
          { value: 'radar', label: t('Mistake radar') },
        ]}
      />
      <div className="mt-4">{tab === 'coverage' ? <Coverage rep={rep} onOpen={onOpen} /> : <Radar rep={rep} onOpen={onOpen} />}</div>
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
      <p className="tnum mt-1.5 text-sm text-ink-2">{p ? t('{done} of {total} positions (one Lichess request at a time)', { done: p.done, total: p.total }) : t('Starting…')}</p>
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
  const pct = (x: number) => new Intl.NumberFormat(intlLocale(), { style: 'percent', maximumFractionDigits: 1 }).format(x);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-2">{t('Through move')}</span>
        <Segmented label={t('Depth')} value={depth} onChange={setDepth} options={['10', '16', '20', '30'].map((v) => ({ value: v, label: String(Math.ceil(Number(v) / 2)) }))} className="w-48" />
        {state.running ? (
          <Button size="sm" onClick={stop}>
            {t('Stop')}
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon={PieChart} onClick={() => void run((s, p) => computeCoverage(rep, moves, Number(depth), s, p))}>
            {res ? t('Recalculate') : t('Calculate')}
          </Button>
        )}
      </div>
      {state.running && <ProgressBar p={state.progress} />}
      {state.error && <p className="mt-3 text-sm text-bad-ink">{state.error}</p>}
      {res && !state.running && (
        <div className="mt-4">
          <p className="text-lg font-bold">
            {tx('Handles {pct} of games at {rating} {speeds} through move {move}', {
              pct: <span className="text-brand-ink">{pct(res.covered)}</span>,
              rating,
              speeds: speeds.map(speedName).join('/'),
              move: Math.ceil(Number(depth) / 2),
            })}
          </p>
          {res.missing.length > 0 && <p className="mt-1 text-sm text-ink-2">{tn(res.missing.length, '{n} position had no explorer data and was split evenly.', '{n} positions had no explorer data and were split evenly.')}</p>}
          {res.gaps.length > 0 && (
            <>
              <h3 className="mt-5 mb-2 text-md font-bold">{t('Biggest gaps')}</h3>
              <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-m)] bg-surface-2">
                {res.gaps.slice(0, 12).map((g) => (
                  <li key={g.epd + g.uci} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-3 text-sm">
                    <span className="tnum w-12 shrink-0 font-bold">{pct(g.reach)}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block">
                        {Math.floor(plyFromFen(epdToFen(g.epd)) / 2) + 1}
                        {plyFromFen(epdToFen(g.epd)) % 2 ? '…' : '.'} {g.san}
                      </b>
                      <span className="block text-sm text-ink-2">
                        {t('{pct} of games there', { pct: fmtPercent(g.share) })} · {tn(g.games, '{n} game', '{n} games')}
                      </span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => onOpen(g.epd)}>
                      {t('Open')}
                    </Button>
                    <Button size="sm" icon={Plus} onClick={() => void lib.addMove(rep.id, epdToFen(g.epd), g.uci).then(() => toast(t('Added {move} — now choose your reply', { move: g.san }), { kind: 'success' }))}>
                      {t('Add')}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {res.undecided.length > 0 && <p className="mt-3 text-sm font-medium text-warn-ink">{tn(res.undecided.length, '{n} position where it’s your move but nothing is prepared.', '{n} positions where it’s your move but nothing is prepared.')}</p>}
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
    toast(t('Added {move} and its refutation — it will come up in training', { move: r.san }), { kind: 'success' });
  };
  return (
    <div>
      <p className="text-base text-ink-2">{t('Popular opponent replies (≥ 5% at your level) that lose at least a pawn according to the engine — know how to punish them.')}</p>
      <div className="mt-3">
        {state.running ? (
          <Button size="sm" onClick={stop}>
            {t('Stop')}
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon={Crosshair} onClick={() => void run((s, p) => computeRadar(rep, moves, s, p))}>
            {state.result ? t('Scan again') : t('Scan repertoire')}
          </Button>
        )}
      </div>
      {state.running && <ProgressBar p={state.progress} />}
      {state.result && !state.running && (
        <ul className="mt-3 flex flex-col gap-2">
          {state.result.length === 0 && <li className="text-sm text-ink-2">{t('No common mistakes found (only positions with cloud evaluations are checked).')}</li>}
          {state.result.map((r) => {
            const pos = positionFromFen(r.afterFen);
            const ref = r.refutation ? uciToSan(pos, r.refutation) : undefined;
            const key = r.epd + r.uci;
            return (
              <li key={key} className="rounded-[var(--radius-m)] bg-surface-2 p-3.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="flex-1">
                    <b>{r.san}</b> <span className="text-ink-2">({fmtPercent(r.share)} · −{r.drop.toFixed(1)})</span>
                    {ref && (
                      <>
                        {' '}
                        → {tx('punish with {move}', { move: <b className="text-good-ink">{ref}</b> })}
                      </>
                    )}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setOpen(open === key ? null : key)}>
                    {t('Why?')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onOpen(r.epd)}>
                    {t('Open')}
                  </Button>
                  {!r.inRepertoire && (
                    <Button size="sm" icon={Plus} onClick={() => void add(r)}>
                      {t('Add')}
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
