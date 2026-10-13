import type { GameMeta, PlyRecord } from '@chessbutfree/core';
import { Chess } from 'chess.js';
import type { TC } from './components';

/** Records a game played on this device: moves, think times, clocks and considered squares. */
export class LocalGame {
  plies: PlyRecord[] = [];
  clocks: { w: number; b: number };
  private started = 0;
  private turn: 'w' | 'b' = 'w';
  over = false;

  constructor(
    public meta: GameMeta,
    public tc: TC | null,
  ) {
    this.clocks = { w: tc?.initialMs ?? 0, b: tc?.initialMs ?? 0 };
    meta.initialMs = tc?.initialMs;
    meta.incrementMs = tc?.incrementMs;
  }

  get fen(): string {
    return this.plies.length ? this.plies[this.plies.length - 1].fenAfter : new Chess().fen();
  }

  /** Clocks only run once both sides have moved. */
  live(): { w: number; b: number } {
    const c = { ...this.clocks };
    if (this.tc && this.plies.length >= 2 && !this.over) c[this.turn] -= performance.now() - this.started;
    return c;
  }

  record(uci: string, thinkMs: number, considered?: string[]): PlyRecord {
    const before = this.fen;
    const c = new Chess(before);
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
    if (this.tc && this.plies.length >= 2) this.clocks[m.color] = this.clocks[m.color] - thinkMs + this.tc.incrementMs;
    const ply: PlyRecord = {
      ply: this.plies.length + 1,
      side: m.color,
      san: m.san,
      uci,
      fenBefore: before,
      fenAfter: c.fen(),
      thinkMs,
      clockMs: this.tc ? this.clocks[m.color] : undefined,
      considered,
    };
    this.plies.push(ply);
    this.turn = c.turn();
    this.started = performance.now();
    return ply;
  }

  takeback(n: number): void {
    this.plies.splice(Math.max(0, this.plies.length - n));
    this.turn = this.plies.length % 2 === 0 ? 'w' : 'b';
    this.started = performance.now();
  }

  /** Side whose flag fell, if any. */
  flagged(): 'w' | 'b' | null {
    if (!this.tc || this.plies.length < 2 || this.over) return null;
    const c = this.live();
    return c[this.turn] <= 0 ? this.turn : null;
  }

  start(): void {
    this.started = performance.now();
  }
}

export function resultOf(chess: Chess): { result: GameMeta['result']; termination: string } | null {
  if (chess.isCheckmate()) return { result: chess.turn() === 'w' ? '0-1' : '1-0', termination: 'checkmate' };
  if (chess.isStalemate()) return { result: '1/2-1/2', termination: 'stalemate' };
  if (chess.isThreefoldRepetition()) return { result: '1/2-1/2', termination: 'repetition' };
  if (chess.isInsufficientMaterial()) return { result: '1/2-1/2', termination: 'insufficient material' };
  if (chess.isDraw()) return { result: '1/2-1/2', termination: '50-move rule' };
  return null;
}

export function resultTitle(result: GameMeta['result'], you?: 'w' | 'b'): string {
  if (result === '1/2-1/2') return 'Draw';
  const winner = result === '1-0' ? 'w' : 'b';
  if (!you) return winner === 'w' ? 'White Won' : 'Black Won';
  return winner === you ? 'You Won!' : winner === 'w' ? 'White Won' : 'Black Won';
}
