import { Chess } from 'chess.js';
import type { GameMeta, PlyRecord } from './types';

function parseClock(comment: string | undefined): number | undefined {
  if (!comment) return undefined;
  const m = comment.match(/\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/);
  if (!m) return undefined;
  return Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000);
}

function parseTimeControl(tc?: string): { initialMs?: number; incrementMs?: number } {
  const m = tc?.match(/^(\d+)(?:\+(\d+))?$/);
  if (!m) return {};
  return { initialMs: Number(m[1]) * 1000, incrementMs: Number(m[2] ?? 0) * 1000 };
}

/**
 * Turn a PGN into ply records. Chess.com and Lichess exports carry `[%clk]` comments, so imported
 * games keep their think times — the richest psychological signal we have.
 */
export function pliesFromPgn(pgn: string): { plies: PlyRecord[]; meta: GameMeta } {
  const game = new Chess();
  game.loadPgn(pgn);
  const headers = game.getHeaders();
  const { initialMs, incrementMs } = parseTimeControl(headers.TimeControl);
  const comments = new Map(game.getComments().map((c) => [c.fen, c.comment]));
  const history = game.history({ verbose: true });

  const lastClock: Record<'w' | 'b', number | undefined> = { w: initialMs, b: initialMs };
  const plies: PlyRecord[] = history.map((m, i) => {
    const side = m.color;
    const clockMs = parseClock(comments.get(m.after));
    let thinkMs: number | undefined;
    const prev = lastClock[side];
    if (clockMs !== undefined && prev !== undefined) thinkMs = Math.max(0, prev - clockMs + (incrementMs ?? 0));
    if (clockMs !== undefined) lastClock[side] = clockMs;
    return {
      ply: i + 1,
      side,
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ''),
      fenBefore: m.before,
      fenAfter: m.after,
      thinkMs,
      clockMs,
    };
  });

  const rating = (s?: string) => (s && /^\d+$/.test(s) ? Number(s) : undefined);
  const result = headers.Result as GameMeta['result'];
  return {
    plies,
    meta: {
      white: headers.White,
      black: headers.Black,
      whiteRating: rating(headers.WhiteElo),
      blackRating: rating(headers.BlackElo),
      initialMs,
      incrementMs,
      result,
      termination: headers.Termination,
    },
  };
}

/** Build ply records from a list of UCI moves (used by the live game recorder and tests). */
export function pliesFromUci(moves: string[], startFen?: string, thinkMs?: number[]): PlyRecord[] {
  const c = startFen ? new Chess(startFen) : new Chess();
  return moves.map((u, i) => {
    const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
    return { ply: i + 1, side: m.color, san: m.san, uci: u, fenBefore: m.before, fenAfter: m.after, thinkMs: thinkMs?.[i] };
  });
}

export function toPgn(plies: PlyRecord[], meta: GameMeta = {}): string {
  const c = new Chess(plies[0]?.fenBefore);
  if (meta.white) c.setHeader('White', meta.white);
  if (meta.black) c.setHeader('Black', meta.black);
  if (meta.result) c.setHeader('Result', meta.result);
  if (meta.initialMs !== undefined) c.setHeader('TimeControl', `${meta.initialMs / 1000}+${(meta.incrementMs ?? 0) / 1000}`);
  for (const p of plies) {
    c.move(p.san);
    if (p.clockMs !== undefined) {
      const s = p.clockMs / 1000;
      const h = Math.floor(s / 3600);
      const mm = Math.floor((s % 3600) / 60);
      const ss = (s % 60).toFixed(1);
      c.setComment(`[%clk ${h}:${String(mm).padStart(2, '0')}:${ss.padStart(4, '0')}]`);
    }
  }
  return c.pgn();
}
