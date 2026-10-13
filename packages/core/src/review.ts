import { Chess } from 'chess.js';
import { evalEP, gameAccuracy, moveAccuracy } from './evaluation';
import { extractFeatures, type MoveFeatures } from './features';
import { identifyOpening, type Opening } from './openings';
import type { Classification, GameMeta, PlyRecord, PositionEval, Side } from './types';

/**
 * Expected-points thresholds, as Chess.com publishes them for Classification V2.
 * A move is graded by how many expected points it costs the mover.
 */
export const EP_THRESHOLDS = { excellent: 0.02, good: 0.05, inaccuracy: 0.1, mistake: 0.2 } as const;

export interface PlyReview {
  ply: number;
  side: Side;
  san: string;
  uci: string;
  classification: Classification;
  /** Mover's expected points before (with best play) and after the move played. */
  epBefore: number;
  epAfter: number;
  epLoss: number;
  /** Expected points of the engine's second choice, when known (for only-move detection). */
  epSecond?: number;
  accuracy: number;
  bestUci?: string;
  bestSan?: string;
  /** Engine principal variation after the best move, in SAN (for "show me" in the UI). */
  bestLineSan: string[];
  features: MoveFeatures;
  /** Opponent's best-reply margin after this move: how narrow a path we left them (0..1). */
  forcing: number;
}

export interface SideSummary {
  accuracy: number;
  counts: Record<Classification, number>;
}

export interface GameReview {
  plies: PlyReview[];
  opening?: Opening;
  /** Index (0-based ply) of the last move still inside named theory; -1 if none. */
  lastBookPly: number;
  white: SideSummary;
  black: SideSummary;
  /** White's win% (0..100) before each ply and after the last one, for the eval graph. */
  winSeries: number[];
}

const ZERO_COUNTS = (): Record<Classification, number> => ({
  book: 0,
  brilliant: 0,
  great: 0,
  best: 0,
  excellent: 0,
  good: 0,
  inaccuracy: 0,
  mistake: 0,
  miss: 0,
  blunder: 0,
  forced: 0,
});

function uciToSan(fen: string, uci: string): string | undefined {
  try {
    const c = new Chess(fen);
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }).san;
  } catch {
    return undefined;
  }
}

function pvToSan(fen: string, pv: string[], max = 8): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of pv.slice(0, max)) {
    try {
      out.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined }).san);
    } catch {
      break;
    }
  }
  return out;
}

/** Mover's expected points after the move: 1 - opponent's EP, or the terminal result. */
function epAfterMove(fenAfter: string, evAfter: PositionEval | null | undefined, rating?: number): number {
  const c = new Chess(fenAfter);
  if (c.isCheckmate()) return 1;
  if (c.isDraw() || c.isStalemate()) return 0.5;
  if (!evAfter || !evAfter.lines.length) return 0.5;
  return 1 - evalEP(evAfter, rating);
}

export function classifyMove(args: {
  epBefore: number;
  epAfter: number;
  epSecond?: number;
  isBest: boolean;
  isBook: boolean;
  features: MoveFeatures;
  opponentPrevLoss: number;
}): Classification {
  const { epBefore, epAfter, epSecond, isBest, isBook, features, opponentPrevLoss } = args;
  const loss = Math.max(0, epBefore - epAfter);
  if (isBook) return 'book';
  if (features.legalMoves === 1) return 'forced';

  if (loss <= EP_THRESHOLDS.excellent) {
    if (features.mate) return 'best';
    // Brilliant: a sound piece sacrifice, played when you were not already cruising.
    if (features.sacrifice && (isBest || loss <= 0.01) && epAfter >= 0.45) return 'brilliant';
    // Great: the only move that holds (second choice is much worse), not a routine recapture/evasion.
    const onlyMove = epSecond !== undefined && epBefore - epSecond >= 0.15;
    const routine = features.recapture || (features.inCheckBefore && features.legalMoves <= 3);
    if (onlyMove && !routine && epAfter > 0.25) return 'great';
    if (isBest || loss <= 0.001) return 'best';
    return 'excellent';
  }
  // Miss: the opponent just erred, you had a real chance, and you let it slip.
  if (opponentPrevLoss >= EP_THRESHOLDS.inaccuracy && epBefore >= 0.7 && loss >= EP_THRESHOLDS.inaccuracy && epAfter >= 0.35) {
    return 'miss';
  }
  if (loss <= EP_THRESHOLDS.good) return 'good';
  if (loss <= EP_THRESHOLDS.inaccuracy) return 'inaccuracy';
  if (loss <= EP_THRESHOLDS.mistake) return 'mistake';
  return 'blunder';
}

/**
 * Review a game. `evals[i]` is the engine read of the position *before* ply i (so evals has
 * plies.length + 1 entries; the last is the final position; null where unavailable).
 */
export function reviewGame(plies: PlyRecord[], evals: (PositionEval | null)[], meta: GameMeta = {}): GameReview {
  const { opening, lastBookIndex } = identifyOpening(plies.map((p) => p.fenAfter));
  const out: PlyReview[] = [];
  const winSeries: number[] = [];

  for (let i = 0; i < plies.length; i++) {
    const p = plies[i];
    const rating = p.side === 'w' ? meta.whiteRating : meta.blackRating;
    const evBefore = evals[i];
    const evAfter = evals[i + 1];
    const epBefore = evBefore ? evalEP(evBefore, rating) : 0.5;
    const epSecond = evBefore && evBefore.lines.length > 1 ? evalEP(evBefore, rating, 1) : undefined;
    let epAfter = epAfterMove(p.fenAfter, evAfter, rating);
    // Horizon fix: if the opponent then played the engine's own best reply, the next position's
    // read is a deeper look at the same line. Engines prune sacrifices at shallow depth, so a
    // combination like Bxd7+ ... Qb8+!! is often only visible one ply later.
    const reply = plies[i + 1];
    const evNext = evals[i + 2];
    if (reply && evAfter && evNext && evAfter.lines[0]?.move === reply.uci && evNext.lines.length) {
      epAfter = Math.max(epAfter, evalEP(evNext, rating));
    }
    const prevPly = plies[i - 1];
    const features = extractFeatures(p.fenBefore, p.uci, prevPly?.san.includes('x') ? prevPly.uci : undefined, p.ply);
    const bestUci = evBefore?.lines[0]?.move;
    const isBest = bestUci === p.uci;
    const prev = out[i - 1];
    // A move never "gains" points (engine noise), and the engine's own first choice costs nothing.
    const effectiveBefore = isBest ? epAfter : Math.max(epBefore, epAfter);
    const classification = classifyMove({
      epBefore: effectiveBefore,
      epAfter,
      epSecond,
      isBest,
      isBook: i <= lastBookIndex,
      features,
      opponentPrevLoss: prev ? prev.epLoss : 0,
    });
    const lineAfter = evAfter?.lines;
    const forcing =
      lineAfter && lineAfter.length > 1 ? Math.min(1, Math.max(0, (evalEP(evAfter!, undefined, 0) - evalEP(evAfter!, undefined, 1)) / 0.2)) : 0;

    winSeries.push(100 * (p.side === 'w' ? epBefore : 1 - epBefore));
    out.push({
      ply: p.ply,
      side: p.side,
      san: p.san,
      uci: p.uci,
      classification,
      epBefore: effectiveBefore,
      epAfter,
      epLoss: Math.max(0, effectiveBefore - epAfter),
      epSecond,
      accuracy: moveAccuracy(100 * effectiveBefore, 100 * epAfter),
      bestUci,
      bestSan: bestUci ? uciToSan(p.fenBefore, bestUci) : undefined,
      bestLineSan: evBefore?.lines[0] ? pvToSan(p.fenBefore, evBefore.lines[0].pv) : [],
      features,
      forcing,
    });
  }
  const last = plies[plies.length - 1];
  if (last) {
    const ep = epAfterMove(last.fenAfter, evals[plies.length], undefined);
    winSeries.push(100 * (last.side === 'w' ? ep : 1 - ep));
  }

  const summarize = (side: Side): SideSummary => {
    const mine = out.filter((r) => r.side === side);
    const counts = ZERO_COUNTS();
    mine.forEach((r) => counts[r.classification]++);
    const accs = mine.filter((r) => r.classification !== 'book').map((r) => ({ ply: r.ply - 1, acc: r.accuracy }));
    return { accuracy: gameAccuracy(accs, winSeries), counts };
  };

  return { plies: out, opening, lastBookPly: lastBookIndex, white: summarize('w'), black: summarize('b'), winSeries };
}
