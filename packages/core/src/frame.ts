import type { PlyReview } from './review';
import type { Side } from './types';

/**
 * FRAME = initiative. Whoever is making threats holds the frame; whoever is answering them has
 * handed it over. This is deliberately separate from the evaluation: you can be +2 and still be
 * the one reacting. The eval bar scores the board; the frame bar scores the players.
 */
export type FrameState = 'green' | 'yellow' | 'red';

export interface FramePoint {
  ply: number;
  /** -1 (black holds the initiative) .. +1 (white holds it). */
  frame: number;
  /** Mover's impulse (threat-making) and reaction (threat-answering) for this ply. */
  impulse: number;
  reaction: number;
  /** Consecutive reactive moves by the mover, including this one. */
  reactiveStreak: number;
  state: { w: FrameState; b: FrameState };
}

export function impulseOf(r: PlyReview): number {
  const f = r.features;
  let x = 0;
  if (f.check) x += 1;
  x += 0.8 * Math.min(2, f.threatsCreated);
  x += 0.15 * Math.max(0, f.kingPressure);
  if (f.capture && !f.recapture) x += 0.4;
  if (f.sacrifice) x += 0.6;
  if (f.pawnStorm) x += 0.3;
  x += 0.8 * r.forcing; // we left the opponent a single narrow path
  return x;
}

export function reactionOf(r: PlyReview): number {
  const f = r.features;
  let x = 0;
  if (f.inCheckBefore) x += 1;
  if (f.respondsToThreat) x += 0.8;
  if (f.recapture) x += 0.6;
  if (f.legalMoves <= 3) x += 0.4;
  if (f.retreat && f.respondsToThreat) x += 0.2;
  return x;
}

export function isReactive(r: PlyReview): boolean {
  return reactionOf(r) >= 0.6 && impulseOf(r) < 0.8;
}

export function frameSeries(plies: PlyReview[]): FramePoint[] {
  // White moves first: the baseline authority, like the closer on a sales call. It can be lost.
  let frame = 0.1;
  const streak: Record<Side, number> = { w: 0, b: 0 };
  const out: FramePoint[] = [];
  for (const r of plies) {
    const impulse = impulseOf(r);
    const reaction = reactionOf(r);
    const net = Math.tanh(impulse - reaction);
    const signed = r.side === 'w' ? net : -net;
    frame = Math.max(-1, Math.min(1, 0.72 * frame + 0.28 * signed));
    streak[r.side] = isReactive(r) ? streak[r.side] + 1 : 0;
    const stateFor = (s: Side): FrameState => {
      const mine = s === 'w' ? frame : -frame;
      if (streak[s] >= 3 || mine < -0.35) return 'red';
      if (mine < -0.1 || streak[s] === 2) return 'yellow';
      return 'green';
    };
    out.push({ ply: r.ply, frame, impulse, reaction, reactiveStreak: streak[r.side], state: { w: stateFor('w'), b: stateFor('b') } });
  }
  return out;
}

/** Share of the game (0..1) each side held the initiative. */
export function initiativeShare(points: FramePoint[]): { w: number; b: number } {
  if (!points.length) return { w: 0.5, b: 0.5 };
  const w = points.filter((p) => p.frame > 0.05).length;
  const b = points.filter((p) => p.frame < -0.05).length;
  const t = Math.max(1, w + b);
  return { w: w / t, b: b / t };
}
