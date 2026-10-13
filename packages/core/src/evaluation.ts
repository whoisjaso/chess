import type { EngineLine, PositionEval } from './types';

/**
 * Win probability model. Chess.com's "Expected Points" model is proprietary but documented in shape:
 * engine eval + rating -> probability of scoring (1 = win, 0.5 = draw, 0 = loss). We use the published
 * Lichess logistic fit (win% = 50 + 50 * (2 / (1 + e^(-0.00368208 * cp)) - 1)) and expose a rating
 * factor so lower-rated players' evaluations convert less sharply into results, as Chess.com does.
 */
const K = 0.00368208;

export function lineToCp(line: EngineLine): number {
  if (line.mate !== undefined) {
    // Mate in n: very large, slightly smaller the further away it is.
    const sign = line.mate > 0 ? 1 : line.mate < 0 ? -1 : 0;
    return sign * (1000 - Math.min(Math.abs(line.mate), 50) * 2);
  }
  return Math.max(-1000, Math.min(1000, line.cp ?? 0));
}

/** Rating-aware slope: 1.0 at ~2000, flatter for beginners, sharper for masters. */
export function ratingFactor(rating?: number): number {
  if (!rating) return 1;
  return Math.max(0.6, Math.min(1.3, 0.55 + rating / 4400));
}

/** Expected points (0..1) for the side to move, given a centipawn score from that side's view. */
export function expectedPoints(cp: number, rating?: number): number {
  return 1 / (1 + Math.exp(-K * ratingFactor(rating) * cp));
}

/** Expected points for the side to move from an engine read (best line). */
export function evalEP(ev: PositionEval, rating?: number, lineIndex = 0): number {
  const line = ev.lines[lineIndex] ?? ev.lines[0];
  if (!line) return 0.5;
  return expectedPoints(lineToCp(line), rating);
}

/** Lichess per-move accuracy from win% before/after (both from the mover's view, 0..100). */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const diff = Math.max(0, winBefore - winAfter);
  const acc = 103.1668 * Math.exp(-0.04354 * diff) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

/**
 * Game accuracy (Lichess method): average of a volatility-weighted mean and a harmonic mean of
 * per-move accuracies. Volatile positions weigh more; a single disaster drags the harmonic mean.
 * `winSeries` is white's win% before each ply plus the final position.
 */
export function gameAccuracy(moveAccs: { ply: number; acc: number }[], winSeries: number[]): number {
  if (!moveAccs.length) return 100;
  const window = Math.max(2, Math.min(8, Math.floor(winSeries.length / 10)));
  let wsum = 0;
  let wacc = 0;
  let hden = 0;
  for (const { ply, acc } of moveAccs) {
    const start = Math.max(0, ply - window);
    const w = Math.max(0.5, Math.min(12, stdev(winSeries.slice(start, ply + 1))));
    wsum += w;
    wacc += w * acc;
    hden += 1 / Math.max(acc, 1);
  }
  const weighted = wacc / wsum;
  const harmonic = moveAccs.length / hden;
  return (weighted + harmonic) / 2;
}
