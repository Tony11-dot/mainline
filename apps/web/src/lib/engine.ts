/**
 * Stockfish 19 (lite NNUE) in a Web Worker.
 * Threaded build when the page is cross-origin isolated (web on Railway, Tauri/Windows), single-threaded
 * otherwise (Capacitor, most Tauri webviews). Scores are converted to White's point of view.
 */
import { sideToMove, type EvalLine } from '@mainline/shared';

export interface EngineInfo {
  fen: string;
  depth: number;
  lines: EvalLine[];
  nps?: number;
  done: boolean;
}

export interface AnalyzeOpts {
  multiPv?: number;
  depth?: number;
  onInfo: (info: EngineInfo) => void;
}

type State = 'idle' | 'starting' | 'ready' | 'searching' | 'stopping' | 'failed';

/** WebKit (Safari, every iOS browser, WKWebView) blocks the nested pthread workers even when isolated. */
const isWebKit = () => /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|OPR|Android/.test(navigator.userAgent);

export const engineFlavor = (): { threaded: boolean; file: string; threads: number } => {
  const threaded = typeof SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated === true && !isWebKit();
  const cores = navigator.hardwareConcurrency || 2;
  return {
    threaded,
    file: threaded ? '/engine/stockfish-19-lite.js' : '/engine/stockfish-19-lite-single.js',
    threads: threaded ? Math.max(1, Math.min(4, cores - 1)) : 1,
  };
};

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;

class Engine {
  private worker?: Worker;
  private state: State = 'idle';
  private readyWaiters: (() => void)[] = [];
  private current?: { fen: string; opts: AnalyzeOpts; lines: EvalLine[]; depth: number; lastEmit: number };
  private pending?: { fen: string; opts: AnalyzeOpts };
  private flavor = engineFlavor();

  get info() {
    return { ...this.flavor, state: this.state };
  }

  private start(): Promise<void> {
    if (this.state === 'failed') return Promise.reject(new Error('engine unavailable'));
    if (this.worker) return this.state === 'starting' ? new Promise((r) => this.readyWaiters.push(r)) : Promise.resolve();
    this.state = 'starting';
    try {
      this.worker = new Worker(this.flavor.file);
    } catch (e) {
      // Threaded build can fail (e.g. SAB withdrawn) → retry single-threaded once.
      if (this.flavor.threaded) {
        this.flavor = { threaded: false, file: '/engine/stockfish-19-lite-single.js', threads: 1 };
        this.worker = new Worker(this.flavor.file);
      } else {
        this.state = 'failed';
        throw e;
      }
    }
    this.worker.onmessage = (e) => this.onLine(String(e.data));
    this.worker.onerror = () => {
      if (this.flavor.threaded) {
        this.fallbackToSingle();
      } else {
        this.state = 'failed';
      }
    };
    this.send('uci');
    // Watchdog: if the threaded build never becomes ready, fall back to single-threaded.
    if (this.flavor.threaded) {
      setTimeout(() => {
        if (this.state === 'starting' && this.flavor.threaded) this.fallbackToSingle();
      }, 8000);
    }
    return new Promise((r) => this.readyWaiters.push(r));
  }

  private fallbackToSingle() {
    this.worker?.terminate();
    this.worker = undefined;
    this.state = 'idle';
    this.flavor = { threaded: false, file: '/engine/stockfish-19-lite-single.js', threads: 1 };
    void this.start();
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private onLine(line: string) {
    if (line === 'uciok') {
      this.send(`setoption name Threads value ${this.flavor.threads}`);
      this.send(`setoption name Hash value ${isMobile() ? 16 : 64}`);
      this.send('isready');
      return;
    }
    if (line === 'readyok' && this.state === 'starting') {
      this.state = 'ready';
      this.readyWaiters.splice(0).forEach((r) => r());
      this.kick();
      return;
    }
    if (line.startsWith('bestmove')) {
      const cur = this.current;
      const wasStopping = this.state === 'stopping';
      this.state = 'ready';
      if (cur && !wasStopping) cur.opts.onInfo({ fen: cur.fen, depth: cur.depth, lines: cur.lines, done: true });
      this.current = undefined;
      this.kick();
      return;
    }
    if (line.startsWith('info') && this.state === 'searching' && this.current) this.parseInfo(line);
  }

  private parseInfo(line: string) {
    const cur = this.current!;
    const t = line.split(' ');
    const at = (k: string) => {
      const i = t.indexOf(k);
      return i >= 0 ? t[i + 1] : undefined;
    };
    if (!t.includes('pv') || t.includes('currmove')) return;
    const depth = Number(at('depth'));
    const multipv = Number(at('multipv') ?? 1);
    const scoreIdx = t.indexOf('score');
    if (scoreIdx < 0) return;
    const kind = t[scoreIdx + 1];
    let value = Number(t[scoreIdx + 2]);
    if (t[scoreIdx + 3] === 'lowerbound' || t[scoreIdx + 3] === 'upperbound') return;
    const pv = t.slice(t.indexOf('pv') + 1);
    if (sideToMove(cur.fen) === 'black') value = -value;
    const entry: EvalLine = kind === 'mate' ? { moves: pv, mate: value } : { moves: pv, cp: value };
    cur.lines[multipv - 1] = entry;
    if (multipv === 1) cur.depth = depth;
    const now = performance.now();
    // Throttle UI updates to ~6/s, but always emit when all PV lines of a new depth are in.
    const complete = multipv === (cur.opts.multiPv ?? 3);
    if (complete && (now - cur.lastEmit > 160 || depth >= (cur.opts.depth ?? 99))) {
      cur.lastEmit = now;
      cur.opts.onInfo({ fen: cur.fen, depth: cur.depth, lines: cur.lines.filter(Boolean).slice(), nps: Number(at('nps')) || undefined, done: false });
    }
  }

  private kick() {
    if (this.state !== 'ready' || !this.pending) return;
    const { fen, opts } = this.pending;
    this.pending = undefined;
    this.current = { fen, opts, lines: [], depth: 0, lastEmit: 0 };
    this.state = 'searching';
    this.send(`setoption name MultiPV value ${opts.multiPv ?? 3}`);
    this.send(`position fen ${fen}`);
    this.send(`go depth ${opts.depth ?? (isMobile() ? 20 : 24)}`);
  }

  /** Analyze a position; replaces any running search. Returns a stop function. */
  analyze(fen: string, opts: AnalyzeOpts): () => void {
    this.pending = { fen, opts };
    if (this.state === 'searching') {
      this.state = 'stopping';
      this.send('stop');
    } else if (this.state === 'ready') {
      this.kick();
    } else if (this.state === 'idle') {
      void this.start().catch(() => undefined);
    }
    return () => {
      if (this.pending?.opts === opts) this.pending = undefined;
      if (this.current?.opts === opts && this.state === 'searching') {
        this.state = 'stopping';
        this.send('stop');
      }
    };
  }

  terminate() {
    this.worker?.terminate();
    this.worker = undefined;
    this.state = 'idle';
  }
}

export const engine = new Engine();
