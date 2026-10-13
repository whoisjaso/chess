export type Side = 'w' | 'b';

/** One engine line (UCI). `cp` is from the side-to-move's perspective, as UCI reports it. */
export interface EngineLine {
  move: string; // uci, e.g. e2e4, e7e8q
  cp?: number;
  mate?: number;
  pv: string[];
}

/** Engine read of a single position (best line first). */
export interface PositionEval {
  fen: string;
  depth: number;
  lines: EngineLine[];
}

/**
 * Everything we know about one half-move. Clock data is optional: an imported PGN may have none,
 * a game played on ChessButFree always has it (that is where the psychology gets its best evidence).
 */
export interface PlyRecord {
  ply: number; // 1-based
  side: Side;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  /** Milliseconds spent on this move. */
  thinkMs?: number;
  /** Clock remaining after the move (ms). */
  clockMs?: number;
  /** Squares the player selected/picked up before committing (client-side only, never shared). */
  considered?: string[];
}

export interface GameMeta {
  white?: string;
  black?: string;
  whiteRating?: number;
  blackRating?: number;
  initialMs?: number;
  incrementMs?: number;
  result?: '1-0' | '0-1' | '1/2-1/2' | '*';
  termination?: string;
}

export type Classification =
  | 'book'
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'
  | 'forced';

/** The six masks (Hughes): primary Significance/Approval/Acceptance, secondary Intelligence/Pity/Strength. */
export type Archetype = 'significance' | 'approval' | 'acceptance' | 'intelligence' | 'pity' | 'strength';

export const ARCHETYPES: Archetype[] = ['significance', 'approval', 'acceptance', 'intelligence', 'pity', 'strength'];
