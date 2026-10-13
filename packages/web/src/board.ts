import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import type { Classification } from '@chessbutfree/core';
import { Chess, type Square } from 'chess.js';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { tierIcon } from './icons';
import { moveSound } from './sound';
import { pref } from './store';

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
  private badgeEl: HTMLElement;
  private premoveColor: Color | undefined;

  constructor(
    private host: HTMLElement,
    private opts: {
      orientation?: Color;
      fen?: string;
      interactive?: Color | 'both';
      onMove?: (uci: string, meta: MoveMeta) => void;
      viewOnly?: boolean;
      sound?: boolean;
      /** Allow premoves for this colour (online/bot games). */
      premove?: Color;
    },
  ) {
    this.chess = new Chess(opts.fen);
    this.interactive = opts.interactive;
    this.premoveColor = opts.premove;
    this.cg = Chessground(host, {
      fen: this.chess.fen(),
      orientation: opts.orientation ?? 'white',
      viewOnly: opts.viewOnly,
      coordinates: pref('coords', true),
      animation: { duration: 160 },
      highlight: { lastMove: true, check: true },
      movable: { free: false, showDests: true, events: { after: (o, d) => this.userMove(o, d) } },
      premovable: { enabled: !!opts.premove },
      draggable: { showGhost: true },
      drawable: { enabled: true },
      events: { select: (k) => this.considered.push(k) },
    });
    this.badgeEl = document.createElement('div');
    this.badgeEl.className = 'sq-badge';
    this.badgeEl.style.display = 'none';
    host.appendChild(this.badgeEl);
    this.sync();
  }

  private userMove(orig: Key, dest: Key): void {
    const piece = this.chess.get(orig as Square);
    const promo = piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1') ? 'q' : '';
    const uci = orig + dest + promo;
    const meta = { thinkMs: Math.round(performance.now() - this.turnStart), considered: [...new Set(this.considered)] };
    if (this.apply(uci) === null) {
      this.sync();
      return;
    }
    this.opts.onMove?.(uci, meta);
  }

  /** Apply a move (from the user, a bot, or the network). Returns SAN, or null if illegal. */
  apply(uci: string, opts: { sound?: boolean } = {}): string | null {
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
    if (opts.sound ?? this.opts.sound ?? true) moveSound(san);
    if (this.premoveColor) setTimeout(() => this.cg.playPremove(), 10);
    return san;
  }

  load(fen: string, lastMove?: string): void {
    this.chess.load(fen);
    this.cg.set({ fen, lastMove: lastMove ? [lastMove.slice(0, 2) as Key, lastMove.slice(2, 4) as Key] : undefined });
    this.turnStart = performance.now();
    this.considered = [];
    this.sync();
  }

  setOnMove(fn: (uci: string, meta: MoveMeta) => void): void {
    this.opts.onMove = fn;
  }

  setInteractive(c: Color | 'both' | undefined): void {
    this.interactive = c;
    if (!c) this.cg.cancelPremove();
    this.sync();
  }

  orientation(c: Color): void {
    this.cg.set({ orientation: c });
  }

  flip(): void {
    this.cg.toggleOrientation();
  }

  shapes(s: DrawShape[]): void {
    this.cg.setAutoShapes(s);
  }

  /** Put a move-rating badge on a square's top-right corner (Game Review). */
  badge(square: string | null, tier?: Classification): void {
    if (!square || !tier) {
      this.badgeEl.style.display = 'none';
      return;
    }
    const white = this.cg.state.orientation === 'white';
    const f = square.charCodeAt(0) - 97;
    const r = Number(square[1]) - 1;
    const col = white ? f : 7 - f;
    const row = white ? 7 - r : r;
    this.badgeEl.replaceChildren(tierIcon(tier));
    this.badgeEl.style.left = `${((col + 1) / 8) * 100}%`;
    this.badgeEl.style.top = `${(row / 8) * 100}%`;
    this.badgeEl.style.display = '';
  }

  private sync(): void {
    const turn: Color = this.chess.turn() === 'w' ? 'white' : 'black';
    const over = this.chess.isGameOver();
    const canMove = !over && (this.interactive === 'both' || this.interactive === turn);
    const premoveFor = !over && this.premoveColor && this.interactive === this.premoveColor && turn !== this.premoveColor ? this.premoveColor : undefined;
    this.cg.set({
      turnColor: turn,
      check: this.chess.inCheck() ? turn : false,
      movable: { color: canMove ? turn : premoveFor, dests: canMove ? dests(this.chess) : new Map() },
    });
  }

  destroy(): void {
    this.cg.destroy();
    this.host.replaceChildren();
  }
}

export const arrow = (uci: string, brush = 'green'): DrawShape => ({ orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush });
