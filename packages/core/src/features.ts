import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import type { Side } from './types';

/**
 * Board-level facts about a move. These are the raw "marked choices" the mind engine reads:
 * out of every legal move, the player picked one with *these* properties.
 */
export interface MoveFeatures {
  piece: PieceSymbol;
  pieceValue: number;
  capture: boolean;
  capturedValue: number;
  check: boolean;
  mate: boolean;
  castle: boolean;
  promotion: boolean;
  /** Captured on the square the opponent just captured on. */
  recapture: boolean;
  /** Capture of an equal-value piece that the opponent can take back (or a recapture). */
  trade: boolean;
  /** Non-capture that offers an equal trade (moves next to an equal enemy piece, defended). */
  tradeOffer: boolean;
  /** Net material handed over by this move per static exchange (>= 2 means a real piece sac). */
  materialGiven: number;
  sacrifice: boolean;
  retreat: boolean;
  development: boolean;
  pawnStorm: boolean;
  /** Change in the number of enemy king-zone squares we attack. */
  kingPressure: number;
  /** Enemy pieces newly threatened (en prise) after this move. */
  threatsCreated: number;
  /** We were in check before moving. */
  inCheckBefore: boolean;
  /** One of our pieces was en prise before the move and the move reduced our hanging material. */
  respondsToThreat: boolean;
  legalMoves: number;
  /** No capture, check, threat, castle, promotion, or king pressure: a waiting/positional move. */
  quiet: boolean;
}

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const SEE_VALUE: Record<PieceSymbol, number> = { ...PIECE_VALUE, k: 100 };

const FILES = 'abcdefgh';

function other(c: Color): Color {
  return c === 'w' ? 'b' : 'w';
}

function attackerValues(chess: Chess, sq: Square, by: Color): number[] {
  return chess
    .attackers(sq, by)
    .map((s) => SEE_VALUE[chess.get(s)!.type])
    .sort((a, b) => a - b);
}

/**
 * Static exchange evaluation: material `by` nets by capturing on `sq` (0 if it would not capture).
 * Approximation: no x-rays, pins ignored. Good enough to tell a sacrifice from a trade.
 */
export function see(chess: Chess, sq: Square, by: Color): number {
  const target = chess.get(sq);
  if (!target || target.color === by) return 0;
  const atk = attackerValues(chess, sq, by);
  const def = attackerValues(chess, sq, target.color);
  if (!atk.length) return 0;
  const gain: number[] = [SEE_VALUE[target.type]];
  let onSquare = atk[0];
  let ai = 1;
  let di = 0;
  let d = 0;
  for (;;) {
    d++;
    const defenderTurn = d % 2 === 1;
    const list = defenderTurn ? def : atk;
    const idx = defenderTurn ? di : ai;
    if (idx >= list.length) break;
    gain[d] = onSquare - gain[d - 1];
    onSquare = list[idx];
    if (defenderTurn) di++;
    else ai++;
  }
  while (--d > 0) gain[d - 1] = -Math.max(-gain[d - 1], gain[d]);
  return Math.max(0, gain[0]);
}

/** Pieces of `color` that the other side can win material on right now: square -> material at risk. */
export function hangingPieces(chess: Chess, color: Color): Map<Square, number> {
  const out = new Map<Square, number>();
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== color || p.type === 'k') continue;
      const loss = see(chess, p.square, other(color));
      if (loss > 0) out.set(p.square, loss);
    }
  }
  return out;
}

function kingSquare(chess: Chess, color: Color): Square {
  for (const row of chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
  throw new Error('no king');
}

function kingZone(sq: Square): Square[] {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]);
  const out: Square[] = [];
  for (let df = -1; df <= 1; df++)
    for (let dr = -1; dr <= 1; dr++) {
      const nf = f + df;
      const nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 1 && nr <= 8) out.push(`${FILES[nf]}${nr}` as Square);
    }
  return out;
}

function zonePressure(chess: Chess, by: Color): number {
  const zone = kingZone(kingSquare(chess, other(by)));
  return zone.filter((s) => chess.isAttacked(s, by)).length;
}

function sumValues(m: Map<Square, number>): number {
  let s = 0;
  for (const v of m.values()) s += v;
  return s;
}

/** Load a FEN, tolerating positions chess.js would reject only for missing kings etc. */
export function board(fen: string): Chess {
  return new Chess(fen);
}

/**
 * Extract features of `uci` played from `fenBefore`.
 * `prevUci` is the opponent's previous move (for recapture detection).
 */
export function extractFeatures(fenBefore: string, uci: string, prevUci?: string, ply = 0): MoveFeatures {
  const before = board(fenBefore);
  const me = before.turn() as Side;
  const them = other(me);
  const legalMoves = before.moves().length;
  const inCheckBefore = before.inCheck();
  const myHangingBefore = sumValues(hangingPieces(before, me));
  const theirHangingBefore = new Set(hangingPieces(before, them).keys());
  const pressureBefore = zonePressure(before, me);

  const after = board(fenBefore);
  const move = after.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as PieceSymbol | undefined });
  const piece = move.piece;
  const pieceValue = PIECE_VALUE[piece];
  const capturedValue = move.captured ? PIECE_VALUE[move.captured] : 0;
  const capture = !!move.captured;
  const castle = move.isKingsideCastle() || move.isQueensideCastle();
  const promotion = !!move.promotion;

  // Material the opponent can now win on the landing square, net of what we just took.
  const lossOnTo = see(after, move.to, them);
  const myHangingAfter = hangingPieces(after, me);
  const newlyHung = Math.max(0, sumValues(myHangingAfter) - myHangingBefore);
  const materialGiven = Math.max(0, Math.max(lossOnTo, newlyHung) - capturedValue);

  const recapture = !!prevUci && capture && prevUci.slice(2, 4) === move.to;
  const canBeRecaptured = after.attackers(move.to, them).length > 0;
  const trade = capture && (recapture || (capturedValue === pieceValue && canBeRecaptured));

  let tradeOffer = false;
  if (!capture && piece !== 'p' && piece !== 'k') {
    const enemyAttackers = after.attackers(move.to, them).map((s) => after.get(s)!.type);
    const defended = after.attackers(move.to, me).length > 0;
    tradeOffer = defended && enemyAttackers.some((t) => PIECE_VALUE[t] === pieceValue);
  }

  const theirHangingAfter = hangingPieces(after, them);
  let threatsCreated = 0;
  for (const sq of theirHangingAfter.keys()) if (!theirHangingBefore.has(sq)) threatsCreated++;

  const kingPressure = zonePressure(after, me) - pressureBefore;
  const fromRank = Number(move.from[1]);
  const toRank = Number(move.to[1]);
  const retreat = !capture && piece !== 'p' && !castle && (me === 'w' ? toRank < fromRank : toRank > fromRank);
  const homeRank = me === 'w' ? 1 : 8;
  const development = castle || ((piece === 'n' || piece === 'b') && fromRank === homeRank && ply <= 30);

  let pawnStorm = false;
  if (piece === 'p' && !capture) {
    const ek = kingSquare(after, them);
    const fileDist = Math.abs(FILES.indexOf(move.to[0]) - FILES.indexOf(ek[0]));
    const advanced = me === 'w' ? toRank >= 4 : toRank <= 5;
    pawnStorm = fileDist <= 2 && advanced && ply > 10;
  }

  const respondsToThreat = myHangingBefore > 0 && sumValues(myHangingAfter) < myHangingBefore;
  const check = after.inCheck();
  const quiet = !capture && !check && !castle && !promotion && threatsCreated === 0 && kingPressure <= 0;

  return {
    piece,
    pieceValue,
    capture,
    capturedValue,
    check,
    mate: after.isCheckmate(),
    castle,
    promotion,
    recapture,
    trade,
    tradeOffer,
    materialGiven,
    sacrifice: materialGiven >= 2 && piece !== 'p',
    retreat,
    development,
    pawnStorm,
    kingPressure,
    threatsCreated,
    inCheckBefore,
    respondsToThreat,
    legalMoves,
    quiet,
  };
}

/** Material balance from white's point of view, in pawns. */
export function materialBalance(fen: string): number {
  let s = 0;
  for (const row of board(fen).board()) for (const p of row) if (p) s += (p.color === 'w' ? 1 : -1) * PIECE_VALUE[p.type];
  return s;
}

export function uciToMove(uci: string): { from: Square; to: Square; promotion?: PieceSymbol } {
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: (uci[4] as PieceSymbol) || undefined };
}
