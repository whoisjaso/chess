import { UciEngine } from '@mindboard/core';

/**
 * Stockfish 17.1 (lite, single-threaded WASM) in a Web Worker. Runs entirely on the user's device:
 * analysis costs the project nothing, which is what lets everything stay free.
 */
let shared: UciEngine | null = null;

export function newEngine(): UciEngine {
  const worker = new Worker('/engine/stockfish.js');
  const listeners: ((l: string) => void)[] = [];
  worker.onmessage = (e: MessageEvent) => {
    const text = String(e.data);
    for (const line of text.split('\n')) listeners.forEach((l) => l(line.trim()));
  };
  return new UciEngine({ send: (c) => worker.postMessage(c), onLine: (cb) => listeners.push(cb) });
}

export function engine(): UciEngine {
  return (shared ??= newEngine());
}
