import { UciEngine, type UciTransport } from '@chessbutfree/core';

/**
 * Stockfish 17.1 in a Web Worker, running entirely on the player's device.
 * Prefers the WebAssembly build; if the host's security policy blocks WebAssembly (or it fails to
 * boot), it falls back to the pure-JavaScript build automatically. Slower, but it works everywhere.
 */
let shared: UciEngine | null = null;
export let engineFlavor: 'wasm' | 'asm' | 'starting' = 'starting';

function workerUrl(file: string): URL {
  return new URL(`${import.meta.env.BASE_URL}engine/${file}`, location.href);
}

function fallbackTransport(): UciTransport {
  const listeners: ((l: string) => void)[] = [];
  const queue: string[] = [];
  let active: Worker | null = null;
  const emit = (data: unknown) => {
    for (const line of String(data).split('\n')) listeners.forEach((l) => l(line.trim()));
  };
  const use = (w: Worker) => {
    active = w;
    w.onmessage = (e) => emit(e.data);
    queue.splice(0).forEach((c) => w.postMessage(c));
  };
  const boot = (file: string, timeoutMs: number): Promise<Worker | null> =>
    new Promise((resolve) => {
      let w: Worker;
      try {
        w = new Worker(workerUrl(file));
      } catch {
        return resolve(null);
      }
      const done = (ok: boolean) => {
        clearTimeout(timer);
        if (ok) resolve(w);
        else {
          w.terminate();
          resolve(null);
        }
      };
      const timer = setTimeout(() => done(false), timeoutMs);
      w.onerror = () => done(false);
      w.onmessage = (e) => String(e.data).includes('uciok') && done(true);
      w.postMessage('uci');
    });
  void (async () => {
    const wasm = await boot('stockfish.js', 6000);
    if (wasm) {
      engineFlavor = 'wasm';
      return use(wasm);
    }
    const asm = await boot('stockfish-asm.js', 30000);
    engineFlavor = asm ? 'asm' : 'starting';
    if (asm) use(asm);
  })();
  return {
    send: (c) => (active ? active.postMessage(c) : queue.push(c)),
    onLine: (cb) => listeners.push(cb),
  };
}

export function newEngine(): UciEngine {
  return new UciEngine(fallbackTransport());
}

export function engine(): UciEngine {
  return (shared ??= newEngine());
}
