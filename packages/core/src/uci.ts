import type { EngineLine, PositionEval } from './types';

/** Parse a UCI `info ... multipv N score cp X ... pv m1 m2` line. */
export function parseInfo(line: string): { multipv: number; depth: number; line: EngineLine } | null {
  if (!line.startsWith('info') || !line.includes(' pv ') || line.includes('lowerbound') || line.includes('upperbound')) return null;
  const tok = line.split(' ');
  const get = (k: string) => {
    const i = tok.indexOf(k);
    return i >= 0 ? tok[i + 1] : undefined;
  };
  const depth = Number(get('depth') ?? 0);
  const multipv = Number(get('multipv') ?? 1);
  const si = tok.indexOf('score');
  const kind = tok[si + 1];
  const val = Number(tok[si + 2]);
  const pv = tok.slice(tok.indexOf('pv') + 1);
  return { multipv, depth, line: { move: pv[0], pv, cp: kind === 'cp' ? val : undefined, mate: kind === 'mate' ? val : undefined } };
}

/** Minimal transport any Stockfish build can provide (Web Worker in the browser, child process in Node). */
export interface UciTransport {
  send(cmd: string): void;
  onLine(cb: (line: string) => void): void;
}

/** Serialised UCI client: one search at a time, returns a full multi-PV read of the position. */
export class UciEngine {
  private queue: Promise<unknown> = Promise.resolve();
  private listener: ((l: string) => void) | null = null;
  private ready: Promise<void>;

  constructor(private t: UciTransport) {
    t.onLine((l) => this.listener?.(l));
    this.ready = this.waitFor('uci', 'uciok').then(() => this.waitFor('isready', 'readyok'));
  }

  private waitFor(cmd: string, token: string): Promise<void> {
    return new Promise((resolve) => {
      this.listener = (l) => {
        if (l.startsWith(token)) resolve();
      };
      this.t.send(cmd);
    });
  }

  analyse(fen: string, opts: { depth?: number; multipv?: number; movetimeMs?: number } = {}): Promise<PositionEval> {
    const run = async () => {
      await this.ready;
      const multipv = opts.multipv ?? 1;
      this.t.send(`setoption name MultiPV value ${multipv}`);
      await this.waitFor('isready', 'readyok');
      return new Promise<PositionEval>((resolve) => {
        const lines: EngineLine[] = [];
        let depth = 0;
        this.listener = (l) => {
          const info = parseInfo(l);
          if (info) {
            if (info.multipv === 1) depth = info.depth;
            lines[info.multipv - 1] = info.line;
          } else if (l.startsWith('bestmove')) {
            const best = l.split(' ')[1];
            if (!lines.length && best && best !== '(none)') lines.push({ move: best, pv: [best], cp: 0 });
            resolve({ fen, depth, lines: lines.filter(Boolean) });
          }
        };
        this.t.send(`position fen ${fen}`);
        this.t.send(opts.movetimeMs ? `go movetime ${opts.movetimeMs}` : `go depth ${opts.depth ?? 14}`);
      });
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  stop(): void {
    this.t.send('stop');
  }
}
