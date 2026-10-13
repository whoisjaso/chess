import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';
import { UciEngine, type PlyRecord, type PositionEval } from '../src';

/** Stockfish 17.1 lite (WASM) as a child process, for tests and server-side tools. */
export function nodeEngine(): { engine: UciEngine; quit: () => void } {
  const require = createRequire(import.meta.url);
  const dir = join(dirname(require.resolve('stockfish/package.json')), 'src');
  const file = readdirSync(dir).find((f) => f.startsWith('stockfish-17.1-lite-single') && f.endsWith('.js'))!;
  const proc = spawn(process.execPath, [join(dir, file)], { stdio: 'pipe' });
  let buf = '';
  const listeners: ((l: string) => void)[] = [];
  proc.stdout.on('data', (d: Buffer) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      listeners.forEach((l) => l(line));
    }
  });
  const engine = new UciEngine({ send: (c) => proc.stdin.write(c + '\n'), onLine: (cb) => listeners.push(cb) });
  return { engine, quit: () => proc.kill() };
}

export async function evalGame(engine: UciEngine, plies: PlyRecord[], depth = 10): Promise<PositionEval[]> {
  const fens = [plies[0].fenBefore, ...plies.map((p) => p.fenAfter)];
  const out: PositionEval[] = [];
  for (const f of fens) out.push(await engine.analyse(f, { depth, multipv: 2 }));
  return out;
}
