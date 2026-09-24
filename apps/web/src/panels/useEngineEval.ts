import { useEffect, useState } from 'react';
import { toEpd, type EvalData, type EvalLine } from '@mainline/shared';
import { engine } from '../lib/engine';
import { fetchCloudEval, rememberLocalEval } from '../lib/evals';

export interface EngineView {
  lines: EvalLine[];
  depth: number;
  source: 'cloud' | 'local' | null;
  searching: boolean;
}

const EMPTY: EngineView = { lines: [], depth: 0, source: null, searching: false };

/**
 * Evaluation for `fen`: Lichess cloud eval (via our cache) when available, local Stockfish otherwise.
 * Local search starts immediately so there's no wait; a cloud hit replaces it.
 */
export function useEngineEval(fen: string, enabled: boolean, multiPv = 3): EngineView {
  const [view, setView] = useState<EngineView>(EMPTY);

  useEffect(() => {
    if (!enabled) {
      setView(EMPTY);
      return;
    }
    let cancelled = false;
    let gotCloud = false;
    setView({ ...EMPTY, searching: true });
    const ctrl = new AbortController();
    const stop = engine.analyze(fen, {
      multiPv,
      onInfo: (info) => {
        if (cancelled || gotCloud) return;
        setView({ lines: info.lines, depth: info.depth, source: 'local', searching: !info.done });
        if (info.done && info.lines.length) {
          const ev: EvalData = { epd: toEpd(fen), depth: info.depth, lines: info.lines, source: 'local' };
          rememberLocalEval(fen, ev);
        }
      },
    });
    fetchCloudEval(fen, ctrl.signal)
      .then((cloud) => {
        if (cancelled || !cloud || cloud.depth < 22 || cloud.lines.length < Math.min(multiPv, 1)) return;
        gotCloud = true;
        stop();
        setView({ lines: cloud.lines.slice(0, multiPv), depth: cloud.depth, source: cloud.source, searching: false });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      ctrl.abort();
      stop();
    };
  }, [fen, enabled, multiPv]);

  return view;
}
