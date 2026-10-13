import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import {
  classifyMove,
  extractFeatures,
  glicko2,
  identifyOpening,
  LESSONS,
  parseInfo,
  pliesFromPgn,
  pliesFromUci,
  see,
  BOTS,
  BOT_LEVELS,
  chooseBotMove,
  COACHES,
} from '../src';

describe('features', () => {
  it('detects a knight fork with check', () => {
    const f = extractFeatures('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'b5c7');
    expect(f.check).toBe(true);
    expect(f.threatsCreated).toBeGreaterThanOrEqual(1);
    expect(f.sacrifice).toBe(false);
  });
  it('detects a piece left en prise as a sacrifice', () => {
    const f = extractFeatures('4k3/8/8/8/3p4/8/8/1N2K3 w - - 0 1', 'b1c3');
    expect(f.materialGiven).toBe(3);
    expect(f.sacrifice).toBe(true);
  });
  it('detects trades and recaptures', () => {
    const fen = '4k3/8/8/3r4/8/8/3R4/4K3 w - - 0 1';
    const f = extractFeatures(fen, 'd2d5');
    expect(f.capture).toBe(true);
    expect(f.sacrifice).toBe(false);
  });
  it('static exchange evaluation', () => {
    const c = new Chess('4k3/8/2p5/3p4/4P3/8/8/4K3 w - - 0 1');
    expect(see(c, 'd5', 'w')).toBe(0); // pawn takes pawn, pawn retakes: net 0
    const c2 = new Chess('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1');
    expect(see(c2, 'd5', 'w')).toBe(9);
  });
  it('flags responding to a threat and retreats', () => {
    // White bishop on e4 attacked by the d5 pawn; Be4-d3 retreats out of danger.
    const f = extractFeatures('4k3/8/8/3p4/4B3/8/8/4K3 w - - 0 1', 'e4d3');
    expect(f.respondsToThreat).toBe(true);
    expect(f.retreat).toBe(true);
  });
});

describe('classification thresholds (Chess.com expected points)', () => {
  const base = { epSecond: undefined, isBest: false, isBook: false, opponentPrevLoss: 0 };
  const features = extractFeatures('4k3/8/8/8/8/8/3P4/4K3 w - - 0 1', 'd2d3');
  const cls = (before: number, after: number) => classifyMove({ ...base, epBefore: before, epAfter: after, features });
  it('maps expected-points loss to labels', () => {
    expect(cls(0.6, 0.6)).toBe('best');
    expect(cls(0.6, 0.585)).toBe('excellent');
    expect(cls(0.6, 0.56)).toBe('good');
    expect(cls(0.6, 0.52)).toBe('inaccuracy');
    expect(cls(0.6, 0.45)).toBe('mistake');
    expect(cls(0.6, 0.2)).toBe('blunder');
  });
  it('labels a missed punishment as a miss', () => {
    expect(classifyMove({ ...base, epBefore: 0.85, epAfter: 0.6, features, opponentPrevLoss: 0.3 })).toBe('miss');
  });
});

describe('Glicko-2', () => {
  it('matches Glickman’s worked example', () => {
    const r = glicko2(
      { rating: 1500, rd: 200, vol: 0.06 },
      [
        { rating: 1400, rd: 30, vol: 0.06 },
        { rating: 1550, rd: 100, vol: 0.06 },
        { rating: 1700, rd: 300, vol: 0.06 },
      ],
      [1, 0, 0],
    );
    expect(r.rating).toBeCloseTo(1464.06, 1);
    expect(r.rd).toBeCloseTo(151.52, 1);
    expect(r.vol).toBeCloseTo(0.05999, 4);
  });
});

describe('openings', () => {
  it('names the Italian Game and finds where theory ends', () => {
    const plies = pliesFromUci(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'h2h3', 'a7a6']);
    const { opening, lastBookIndex } = identifyOpening(plies.map((p) => p.fenAfter));
    expect(opening?.name).toMatch(/Italian Game/);
    expect(lastBookIndex).toBeGreaterThanOrEqual(5);
  });
});

describe('PGN import keeps clocks', () => {
  it('derives think time from [%clk] comments', () => {
    const pgn = `[White "A"]\n[Black "B"]\n[TimeControl "180+2"]\n[Result "*"]\n\n1. e4 {[%clk 0:03:01]} e5 {[%clk 0:03:00]} 2. Nf3 {[%clk 0:02:50]} Nc6 {[%clk 0:02:31]} *`;
    const { plies, meta } = pliesFromPgn(pgn);
    expect(meta.initialMs).toBe(180000);
    expect(plies[2].thinkMs).toBe(13000); // 181 - 170 + 2
    expect(plies[3].thinkMs).toBe(31000); // 180 - 151 + 2
  });
});

describe('UCI parsing', () => {
  it('parses multipv info lines', () => {
    const i = parseInfo('info depth 10 seldepth 16 multipv 2 score cp -44 nodes 1 pv e7e5 b1c3');
    expect(i?.multipv).toBe(2);
    expect(i?.line.cp).toBe(-44);
    expect(i?.line.move).toBe('e7e5');
    expect(parseInfo('info depth 3 score mate 2 pv d1h5')?.line.mate).toBe(2);
  });
});

describe('lessons are valid', () => {
  for (const lesson of LESSONS) {
    it(lesson.id, () => {
      for (const step of lesson.steps) {
        if (step.fen) new Chess(step.fen); // throws if invalid
        if (!step.tasks) continue;
        expect(step.fen).toBeTruthy();
        for (const t of step.tasks) {
          // every accepted answer must be legal from the line reached by the first answer
          for (const alt of t.accept) {
            const probe = new Chess(step.fen!);
            const path = step.tasks.slice(0, step.tasks.indexOf(t));
            for (const prev of path) {
              probe.move({ from: prev.accept[0].slice(0, 2), to: prev.accept[0].slice(2, 4), promotion: prev.accept[0][4] });
              if (prev.reply) probe.move({ from: prev.reply.slice(0, 2), to: prev.reply.slice(2, 4) });
            }
            expect(() => probe.move({ from: alt.slice(0, 2), to: alt.slice(2, 4), promotion: alt[4] })).not.toThrow();
          }
        }
        const c = new Chess(step.fen!);
        for (const t of step.tasks) {
          c.move({ from: t.accept[0].slice(0, 2), to: t.accept[0].slice(2, 4), promotion: t.accept[0][4] });
          if (t.reply) c.move({ from: t.reply.slice(0, 2), to: t.reply.slice(2, 4) });
        }
        if (step.goal === 'mate') expect(c.isCheckmate()).toBe(true);
      }
    });
  }
});

describe('bots and coaches', () => {
  it('each bot returns a legal move', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const lines = [
      { move: 'f1b5', cp: 30, pv: ['f1b5'] },
      { move: 'd2d4', cp: 25, pv: ['d2d4'] },
      { move: 'f1c4', cp: 20, pv: ['f1c4'] },
    ];
    for (const bot of BOTS) {
      const m = chooseBotMove(fen, lines, bot, BOT_LEVELS[3], () => 0.99);
      expect(new Chess(fen).moves({ verbose: true }).some((x) => x.from + x.to === m)).toBe(true);
    }
  });
  it('every coach spars as a real bot and teaches real lessons', () => {
    for (const c of COACHES) {
      expect(BOTS.some((b) => b.id === c.sparsAs)).toBe(true);
      for (const id of c.teaches) expect(LESSONS.some((l) => l.id === id)).toBe(true);
    }
  });
});
