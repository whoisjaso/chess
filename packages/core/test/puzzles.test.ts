import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { PUZZLES } from '../src';

const mv = (c: Chess, u: string) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });

/** Does the side to move force mate within n of its own moves? (brute force) */
function forcesMate(c: Chess, n: number): boolean {
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    let ok: boolean;
    if (c.isCheckmate()) ok = true;
    else if (n === 1 || c.isGameOver()) ok = false;
    else ok = c.moves({ verbose: true }).every((r) => {
      c.move(r);
      const res = forcesMate(c, n - 1);
      c.undo();
      return res;
    });
    c.undo();
    if (ok) return true;
  }
  return false;
}

describe('puzzles are sound', () => {
  for (const p of PUZZLES) {
    it(`${p.id} ${p.themes.join(',')}`, () => {
      const c = new Chess(p.fen);
      for (const u of p.solution) expect(() => mv(c, u)).not.toThrow();
      const mate = p.themes.find((t) => t.startsWith('mateIn'));
      if (mate) {
        expect(c.isCheckmate()).toBe(true);
        const n = Number(mate.slice(6));
        // the first move must force mate against every defence
        const start = new Chess(p.fen);
        mv(start, p.solution[0]);
        if (n === 1) expect(start.isCheckmate()).toBe(true);
        else expect(start.moves({ verbose: true }).every((r) => { start.move(r); const ok = start.isCheckmate() || forcesMate(start, n - 1); start.undo(); return ok; })).toBe(true);
      }
    });
  }
});
