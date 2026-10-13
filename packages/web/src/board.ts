import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import { Chess, type Square } from 'chess.js';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';

export type Color = 'white' | 'black';

export interface MoveMeta {
  thinkMs: number;
  /** Squares picked up before this move (stays on this device; feeds the Mind Engine). */
  considered: string[];
}

export function dests(chess: Chess): Map<Key, Key[]> {
  const m = new Map<Key, Key[]>();
  for (const mv of chess.moves({ verbose: true })) {
    const list = m.get(mv.from as Key) ?? [];
    list.push(mv.to as Key);
    m.set(mv.from as Key, list);
  }
  return m;
}

/** chessground + chess.js, recording think time and which pieces were considered. */
export class Board {
  cg: Api;
  chess: Chess;
  private considered: string[] = [];
  private turnStart = performance.now();
  private interactive: Color | 'both' | undefined;

  constructor(
    el: HTMLElement,
    private opts: { orientation?: Color; fen?: string; interactive?: Color | 'both'; onMove?: (uci: string, meta: MoveMeta) => void },
  ) {
    this.chess = new Chess(opts.fen);
    this.interactive = opts.interactive;
    this.cg = Chessground(el, {
      fen: this.chess.fen(),
      orientation: opts.orientation ?? 'white',
      animation: { duration: 180 },
      highlight: { lastMove: true, check: true },
      movable: { free: false, showDests: true, events: { after: (o, d) => this.userMove(o, d) } },
      premovable: { enabled: false },
      draggable: { showGhost: true },
      events: { select: (k) => this.considered.push(k) },
    });
    this.sync();
  }

  private userMove(orig: Key, dest: Key): void {
    const piece = this.chess.get(orig as Square);
    const promo = piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1') ? 'q' : '';
    const uci = orig + dest + promo;
    const meta = { thinkMs: Math.round(performance.now() - this.turnStart), considered: [...new Set(this.considered)] };
    this.apply(uci);
    this.opts.onMove?.(uci, meta);
  }

  /** Apply a move (from the user, a bot, or the network). Returns SAN, or null if illegal. */
  apply(uci: string): string | null {
    let san: string;
    try {
      san = this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }).san;
    } catch {
      return null;
    }
    this.cg.set({ fen: this.chess.fen(), lastMove: [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key] });
    this.considered = [];
    this.turnStart = performance.now();
    this.sync();
    return san;
  }

  load(fen: string, lastMove?: string): void {
    this.chess.load(fen);
    this.cg.set({ fen, lastMove: lastMove ? [lastMove.slice(0, 2) as Key, lastMove.slice(2, 4) as Key] : undefined });
    this.turnStart = performance.now();
    this.considered = [];
    this.sync();
  }

  setInteractive(c: Color | 'both' | undefined): void {
    this.interactive = c;
    this.sync();
  }

  orientation(c: Color): void {
    this.cg.set({ orientation: c });
  }

  shapes(s: DrawShape[]): void {
    this.cg.setAutoShapes(s);
  }

  private sync(): void {
    const turn: Color = this.chess.turn() === 'w' ? 'white' : 'black';
    const canMove = !this.chess.isGameOver() && (this.interactive === 'both' || this.interactive === turn);
    this.cg.set({
      turnColor: turn,
      check: this.chess.inCheck() ? turn : false,
      movable: { color: canMove ? turn : undefined, dests: canMove ? dests(this.chess) : new Map() },
    });
  }
}

export const arrow = (uci: string, brush = 'green'): DrawShape => ({ orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush });
