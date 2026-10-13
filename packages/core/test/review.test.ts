import { afterAll, describe, expect, it } from 'vitest';
import { coachReport, readMinds, reviewGame, pliesFromPgn, pliesFromUci, COACHES, coachSay } from '../src';
import { evalGame, nodeEngine } from './engine';

const { engine, quit } = nodeEngine();
afterAll(quit);

// Morphy vs Duke Karl / Count Isouard, Paris 1858 ("The Opera Game"), with invented clocks.
const OPERA = `[Event "Paris"]
[White "Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]
[TimeControl "600+0"]

1. e4 {[%clk 0:09:58]} e5 {[%clk 0:09:57]} 2. Nf3 {[%clk 0:09:55]} d6 {[%clk 0:09:50]} 3. d4 {[%clk 0:09:50]} Bg4 {[%clk 0:09:30]}
4. dxe5 {[%clk 0:09:30]} Bxf3 {[%clk 0:09:20]} 5. Qxf3 {[%clk 0:09:25]} dxe5 {[%clk 0:09:15]} 6. Bc4 {[%clk 0:09:00]} Nf6 {[%clk 0:09:10]}
7. Qb3 {[%clk 0:08:40]} Qe7 {[%clk 0:08:00]} 8. Nc3 {[%clk 0:08:20]} c6 {[%clk 0:07:50]} 9. Bg5 {[%clk 0:08:00]} b5 {[%clk 0:07:47]}
10. Nxb5 {[%clk 0:07:00]} cxb5 {[%clk 0:07:40]} 11. Bxb5+ {[%clk 0:06:55]} Nbd7 {[%clk 0:07:30]} 12. O-O-O {[%clk 0:06:40]} Rd8 {[%clk 0:07:00]}
13. Rxd7 {[%clk 0:06:20]} Rxd7 {[%clk 0:06:58]} 14. Rd1 {[%clk 0:06:10]} Qe6 {[%clk 0:06:00]} 15. Bxd7+ {[%clk 0:06:00]} Nxd7 {[%clk 0:05:58]}
16. Qb8+ {[%clk 0:05:30]} Nxb8 {[%clk 0:05:55]} 17. Rd8# {[%clk 0:05:29]} 1-0`;

describe('full review + mind read (real Stockfish)', () => {
  it('reviews the Opera Game', async () => {
    const { plies, meta } = pliesFromPgn(OPERA);
    const evals = await evalGame(engine, plies, 12);
    const review = reviewGame(plies, evals, meta);
    const byPly = (n: number) => review.plies[n - 1];
    expect(review.opening?.name).toMatch(/Philidor/);
    expect(byPly(1).classification).toBe('book');
    expect(byPly(31).san).toBe('Qb8+');
    expect(byPly(31).features.sacrifice).toBe(true);
    expect(byPly(31).classification).toBe('brilliant');
    expect(byPly(33).features.mate).toBe(true);
    expect(review.white.accuracy).toBeGreaterThan(review.black.accuracy);

    const mind = readMinds(review, plies, meta);
    expect(mind.reads).toHaveLength(plies.length);
    expect(mind.white.initiativeShare).toBeGreaterThan(mind.black.initiativeShare);
    expect(mind.keyMoments.some((k) => k.kind === 'script-break')).toBe(true);
    const sum = Object.values(mind.white.archetypes).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);

    const report = coachReport(review, mind);
    expect(report.paragraphs.length).toBeGreaterThan(1);
    expect(report.forPlayer.w.mask).toMatch(/%/);
    const lumen = COACHES.find((c) => c.id === 'lumen')!;
    expect(coachSay(lumen, byPly(31), mind.reads[30])).toMatch(/sacrifice|planned/i);
  });

  it('catches the blunder, the impulse and the tilt', async () => {
    // 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7# — Black's 3rd move snapped off in 1s vs a 20s median.
    const moves = ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'];
    const think = [2000, 20000, 3000, 20000, 4000, 1000, 1500];
    const plies = pliesFromUci(moves, undefined, think);
    const evals = await evalGame(engine, plies, 10);
    const review = reviewGame(plies, evals, {});
    expect(review.plies[5].classification).toBe('blunder');
    expect(review.plies[6].classification).not.toBe('blunder');
    const mind = readMinds(review, plies, {});
    expect(mind.reads[5].why).toMatch(/Blunder/);
  });
});
