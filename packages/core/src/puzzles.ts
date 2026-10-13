import { Chess } from 'chess.js';
import type { GameReview } from './review';
import type { PlyRecord } from './types';

/**
 * Puzzles. Chess.com mines positions from real games where one move wins, then rates puzzle and
 * player against each other (Glicko). We ship a curated, test-verified starter set and generate
 * personal puzzles from your own reviewed mistakes ("learn from your mistakes").
 */
export interface Puzzle {
  id: string;
  fen: string;
  /** Solution in UCI, alternating solver / opponent. The solver plays moves 0, 2, 4... */
  solution: string[];
  rating: number;
  themes: string[];
  title?: string;
  /** For puzzles generated from your games. */
  source?: { gameId: string; ply: number };
}

export const PUZZLES: Puzzle[] = [
  { id: 'p01', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', solution: ['d1d8'], rating: 400, themes: ['mateIn1', 'backRank'] },
  { id: 'p02', fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', solution: ['d8h4'], rating: 450, themes: ['mateIn1', 'opening'] },
  { id: 'p03', fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1', solution: ['h1h8'], rating: 500, themes: ['mateIn1', 'endgame'] },
  { id: 'p04', fen: 'r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1', solution: ['a8a1'], rating: 500, themes: ['mateIn1', 'backRank'] },
  { id: 'p05', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', solution: ['h5f7'], rating: 550, themes: ['mateIn1', 'opening'] },
  { id: 'p06', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', solution: ['g5f7'], rating: 700, themes: ['mateIn1', 'smotheredMate'] },
  { id: 'p07', fen: '7k/8/5N2/8/8/8/8/6RK w - - 0 1', solution: ['g1g8'], rating: 750, themes: ['mateIn1', 'arabianMate'] },
  { id: 'p08', fen: 'r1bqk2r/ppppnppp/2n5/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1', solution: ['f3f7'], rating: 650, themes: ['mateIn1', 'opening'] },
  { id: 'p09', fen: '7k/8/6K1/8/8/8/8/Q7 w - - 0 1', solution: ['a1a8'], rating: 450, themes: ['mateIn1', 'endgame'] },
  { id: 'p10', fen: '4k3/8/8/8/8/8/R7/1R4K1 w - - 0 1', solution: ['b1b7', 'e8f8', 'a2a8'], rating: 800, themes: ['mateIn2', 'ladderMate'] },
  { id: 'p11', fen: 'r6k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1', solution: ['b3g8', 'a8g8', 'h6f7'], rating: 1400, themes: ['mateIn2', 'smotheredMate', 'sacrifice'], title: 'Philidor’s legacy' },
  { id: 'p12', fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', solution: ['b5c7', 'e8d7', 'c7a8'], rating: 600, themes: ['fork'] },
  { id: 'p13', fen: '4q3/8/8/4k3/8/8/8/R6K w - - 0 1', solution: ['a1e1', 'e5d4', 'e1e8'], rating: 700, themes: ['skewer'] },
  { id: 'p14', fen: '6k1/pp3ppp/8/8/8/8/PP3PPP/2R3K1 w - - 0 1', solution: ['c1c8'], rating: 450, themes: ['mateIn1', 'backRank'] },
];

/** Check a solver move against the expected one (any mating move counts as correct on the final step). */
export function checkPuzzleMove(fen: string, expected: string, played: string, isLast: boolean): boolean {
  if (played.slice(0, 4) === expected.slice(0, 4)) return true;
  if (!isLast) return false;
  const c = new Chess(fen);
  try {
    c.move({ from: played.slice(0, 2), to: played.slice(2, 4), promotion: played[4] || 'q' });
  } catch {
    return false;
  }
  return c.isCheckmate();
}

/** Turn your own mistakes into puzzles: the position before the error, the engine's move as answer. */
export function puzzlesFromReview(gameId: string, plies: PlyRecord[], review: GameReview, side?: 'w' | 'b'): Puzzle[] {
  return review.plies
    .filter((r) => (r.classification === 'blunder' || r.classification === 'mistake' || r.classification === 'miss') && r.bestUci && (!side || r.side === side))
    .map((r) => ({
      id: `${gameId}-${r.ply}`,
      fen: plies[r.ply - 1].fenBefore,
      solution: [r.bestUci!],
      rating: 1200,
      themes: ['yourMistake', r.classification],
      title: `Your move ${Math.ceil(r.ply / 2)}: you played ${r.san}`,
      source: { gameId, ply: r.ply },
    }));
}
