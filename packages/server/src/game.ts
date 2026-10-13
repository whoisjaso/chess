import { Chess } from 'chess.js';
import type { PlayerInfo, TimeControl, WireGame } from '@chessbutfree/core';

export type Color = 'w' | 'b';

/** Max lag we refund per move: the client's own think time is trusted up to this much below the server's. */
const MAX_LAG_COMP_MS = 1000;

/**
 * Server-authoritative game. Rules are validated with chess.js; clocks run on the server.
 * Every move is stored with its think time and remaining clock — the raw material for the Mind Engine.
 */
export class Game {
  readonly chess: Chess;
  readonly data: WireGame;
  /** Ratings applied and result broadcast. */
  settled = false;
  private turnStartedAt = 0;

  constructor(
    id: string,
    tc: TimeControl,
    rated: boolean,
    white: PlayerInfo,
    black: PlayerInfo,
    private now: () => number = Date.now,
  ) {
    this.chess = new Chess();
    this.data = {
      id,
      tc,
      rated,
      white,
      black,
      startFen: this.chess.fen(),
      moves: [],
      clocks: { w: tc.initialMs, b: tc.initialMs },
      turn: 'w',
      status: 'playing',
    };
    this.turnStartedAt = now();
  }

  colorOf(playerId: string): Color | undefined {
    if (this.data.white.id === playerId) return 'w';
    if (this.data.black.id === playerId) return 'b';
    return undefined;
  }

  /** Live clocks, counting the running side down. */
  liveClocks(): { w: number; b: number } {
    const c = { ...this.data.clocks };
    if (this.data.status === 'playing' && this.data.moves.length >= 2) c[this.data.turn] -= this.now() - this.turnStartedAt;
    return c;
  }

  /** Clocks only start after each side's first move (like Lichess/Chess.com). */
  private clockRunning(): boolean {
    return this.data.moves.length >= 2;
  }

  move(playerId: string, uci: string, clientThinkMs: number): { ok: true; san: string; thinkMs: number } | { ok: false; error: string } {
    const color = this.colorOf(playerId);
    if (this.data.status !== 'playing') return { ok: false, error: 'game over' };
    if (color !== this.data.turn) return { ok: false, error: 'not your turn' };
    const serverElapsed = this.now() - this.turnStartedAt;
    const thinkMs = Math.max(0, Math.min(serverElapsed, Math.max(clientThinkMs, serverElapsed - MAX_LAG_COMP_MS)));
    if (this.clockRunning() && this.data.clocks[color] - thinkMs <= 0) {
      this.flag(color);
      return { ok: false, error: 'flagged' };
    }
    let san: string;
    try {
      san = this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }).san;
    } catch {
      return { ok: false, error: 'illegal move' };
    }
    if (this.clockRunning()) this.data.clocks[color] = this.data.clocks[color] - thinkMs + this.data.tc.incrementMs;
    this.data.moves.push({ uci, san, thinkMs, clockMs: this.data.clocks[color] });
    this.data.turn = this.chess.turn();
    this.data.drawOfferBy = undefined;
    this.turnStartedAt = this.now();
    this.checkEnd();
    return { ok: true, san, thinkMs };
  }

  private checkEnd(): void {
    const c = this.chess;
    if (c.isCheckmate()) this.end(c.turn() === 'w' ? '0-1' : '1-0', 'checkmate');
    else if (c.isStalemate()) this.end('1/2-1/2', 'stalemate');
    else if (c.isThreefoldRepetition()) this.end('1/2-1/2', 'threefold repetition');
    else if (c.isInsufficientMaterial()) this.end('1/2-1/2', 'insufficient material');
    else if (c.isDraw()) this.end('1/2-1/2', 'fifty-move rule');
  }

  /** Called on a timer: ends the game if the side to move has run out. */
  tick(): boolean {
    if (this.data.status !== 'playing' || !this.clockRunning()) return false;
    const c = this.liveClocks();
    if (c[this.data.turn] <= 0) {
      this.flag(this.data.turn);
      return true;
    }
    return false;
  }

  private flag(color: Color): void {
    this.data.clocks[color] = 0;
    // Lichess rule: a flag against a side that cannot be mated is a draw.
    const opp: Color = color === 'w' ? 'b' : 'w';
    const pieces = this.chess.board().flat().filter((p) => p && p.color === opp && p.type !== 'k');
    const canMate = pieces.length > 0 && !(pieces.length === 1 && (pieces[0]!.type === 'n' || pieces[0]!.type === 'b'));
    this.end(canMate ? (color === 'w' ? '0-1' : '1-0') : '1/2-1/2', 'time');
  }

  resign(playerId: string): boolean {
    const color = this.colorOf(playerId);
    if (!color || this.data.status !== 'playing') return false;
    this.end(color === 'w' ? '0-1' : '1-0', 'resignation');
    return true;
  }

  abort(playerId: string): boolean {
    if (!this.colorOf(playerId) || this.data.status !== 'playing' || this.data.moves.length >= 2) return false;
    this.end(undefined, 'aborted');
    return true;
  }

  offerDraw(playerId: string): boolean {
    const color = this.colorOf(playerId);
    if (!color || this.data.status !== 'playing') return false;
    if (this.data.drawOfferBy && this.data.drawOfferBy !== color) {
      this.end('1/2-1/2', 'agreement');
      return true;
    }
    this.data.drawOfferBy = color;
    return true;
  }

  answerDraw(playerId: string, accept: boolean): boolean {
    const color = this.colorOf(playerId);
    if (!color || !this.data.drawOfferBy || this.data.drawOfferBy === color) return false;
    if (accept) this.end('1/2-1/2', 'agreement');
    else this.data.drawOfferBy = undefined;
    return true;
  }

  private end(result: WireGame['result'], termination: string): void {
    this.data.clocks = this.liveClocks();
    this.data.status = 'ended';
    this.data.result = result;
    this.data.termination = termination;
  }

  pgn(): string {
    const c = new Chess();
    c.setHeader('Event', this.data.rated ? 'Rated game' : 'Casual game');
    c.setHeader('Site', 'ChessButFree');
    c.setHeader('White', this.data.white.name);
    c.setHeader('Black', this.data.black.name);
    c.setHeader('WhiteElo', String(Math.round(this.data.white.rating)));
    c.setHeader('BlackElo', String(Math.round(this.data.black.rating)));
    c.setHeader('TimeControl', `${this.data.tc.initialMs / 1000}+${this.data.tc.incrementMs / 1000}`);
    c.setHeader('Result', this.data.result ?? '*');
    if (this.data.termination) c.setHeader('Termination', this.data.termination);
    for (const m of this.data.moves) {
      c.move(m.san);
      const s = Math.max(0, m.clockMs) / 1000;
      c.setComment(`[%clk ${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}]`);
    }
    return c.pgn();
  }
}
