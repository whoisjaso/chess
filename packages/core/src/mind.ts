import { frameSeries, initiativeShare, impulseOf, isReactive, reactionOf, type FramePoint } from './frame';
import type { MoveFeatures } from './features';
import type { GameReview, PlyReview } from './review';
import { ARCHETYPES, type Archetype, type GameMeta, type PlyRecord, type Side } from './types';

/**
 * THE MIND ENGINE
 *
 * The engine scores the board. This module reads the player.
 *
 * Every move is a selection from many legal options, so the specific choice leaks the weighting
 * underneath (Principle 5: Leakage). We read that leakage through four FATE entry points plus
 * frame and mask:
 *   focus     - script breaks (leaving opening theory), long thinks, what was noticed or missed
 *   authority - holding quality and initiative under pressure (identity made visible)
 *   tribe     - conformity: trading down to safety, retreating unprovoked, staying in book
 *   emotion   - impulse, tilt after a setback, collapse in time trouble
 *   frame     - who is making threats vs who is answering them
 *   mask      - the archetype blend the choices keep pointing at
 */
export type Lens = 'focus' | 'authority' | 'tribe' | 'emotion' | 'frame' | 'mask';

export type TagCode =
  | 'script-break'
  | 'improvising'
  | 'deep-think'
  | 'overthink-routine'
  | 'impulse'
  | 'reactive'
  | 'frame-lost'
  | 'frame-seized'
  | 'counter-punch'
  | 'loud-bluff'
  | 'spectacle'
  | 'safety-trade'
  | 'retreat-unprovoked'
  | 'tilt'
  | 'pressure-crack'
  | 'pressure-hold'
  | 'missed-gift'
  | 'hesitation'
  | 'abandoned-best'
  | 'free-choice';

export interface MindTag {
  code: TagCode;
  lens: Lens;
  label: string;
  detail: string;
}

export type MoveStyle = 'sacrifice' | 'attack' | 'trade' | 'retreat' | 'pawn-storm' | 'develop' | 'capture' | 'defend' | 'quiet';

export interface MindRead {
  ply: number;
  side: Side;
  style: MoveStyle;
  tags: MindTag[];
  /** thinkMs / player's median think. Undefined when the game has no clock data. */
  thinkRatio?: number;
  /** Was the mover under pressure (clock, recent own error, lost frame, fresh out of book)? */
  pressure: boolean;
  pressureReasons: string[];
  /** Two or more moves were (near-)equally good: the choice was the player's, not the position's. */
  freeChoice: boolean;
  /** One- or two-sentence "why" in plain language. */
  why: string;
}

export interface PlayerProfile {
  side: Side;
  name?: string;
  /** Archetype weights, summing to 1. */
  archetypes: Record<Archetype, number>;
  /** The two-mask blend (Principle 4). */
  mask: [Archetype, Archetype];
  /** Evidence strings per archetype: "move 14 Bxh7+ — sacrifice while equal". */
  evidence: Record<Archetype, string[]>;
  /**
   * Identity index 0..100: quality under pressure relative to quality when calm.
   * High = built identity (holds under pressure). Low = borrowed/ego (collapses when the mask is stripped).
   */
  identity?: number;
  accuracyCalm?: number;
  accuracyPressure?: number;
  /** Accuracy in the first five own moves after leaving theory. */
  accuracyOutOfBook?: number;
  initiativeShare: number;
  impulseErrors: number;
  tiltEvents: number;
  scriptBreakPly?: number;
  medianThinkMs?: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface KeyMoment {
  ply: number;
  side: Side;
  kind: 'swing' | 'script-break' | 'frame-flip' | 'pressure';
  title: string;
  detail: string;
}

export interface MindReport {
  reads: MindRead[];
  frame: FramePoint[];
  white: PlayerProfile;
  black: PlayerProfile;
  keyMoments: KeyMoment[];
}

export const ARCHETYPE_INFO: Record<Archetype, { title: string; core: string; board: string; inverse: string }> = {
  significance: {
    title: 'Significance',
    core: 'Needs to matter, to be seen as exceptional.',
    board: 'Hunts the spectacular: sacrifices and checks even when a quiet move is better.',
    inverse: 'Loud brilliance-hunting can cover a fear of being ordinary.',
  },
  approval: {
    title: 'Approval',
    core: 'Needs a judge to say "well done".',
    board: 'Trades into safety, avoids risk, simplifies to positions that cannot embarrass.',
    inverse: 'Constant safety-seeking can cover a fear of being judged for losing.',
  },
  acceptance: {
    title: 'Acceptance',
    core: 'Needs to belong to the group.',
    board: 'Plays what the books say, stays in mainstream theory, rarely deviates.',
    inverse: 'Perfect conformity can cover a fear of thinking alone.',
  },
  intelligence: {
    title: 'Intelligence',
    core: 'Needs to be right, to be "the smart one".',
    board: 'Long thinks, even on obvious moves; prefers to calculate everything to prove it.',
    inverse: 'Over-calculation can cover a fear of being caught not knowing.',
  },
  pity: {
    title: 'Pity',
    core: 'Seeks care through hardship; the setback becomes the story.',
    board: 'Quality collapses after a mistake; goes passive when pressed; tilts.',
    inverse: 'Collapse after one error can cover a fear that effort will not be enough.',
  },
  strength: {
    title: 'Strength',
    core: 'Needs control; passivity feels like danger.',
    board: 'Takes the initiative even at a cost, counter-attacks instead of defending.',
    inverse: 'Relentless aggression can cover insecurity about the position.',
  },
};

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function moveNo(ply: number): string {
  const n = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${n}.` : `${n}...`;
}

function fmtMs(ms: number): string {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

export function styleOf(f: MoveFeatures): MoveStyle {
  if (f.sacrifice) return 'sacrifice';
  if (f.check || f.threatsCreated > 0 || f.kingPressure >= 2) return 'attack';
  if (f.trade || f.tradeOffer) return 'trade';
  if (f.respondsToThreat || f.inCheckBefore) return 'defend';
  if (f.retreat) return 'retreat';
  if (f.pawnStorm) return 'pawn-storm';
  if (f.development || f.castle) return 'develop';
  if (f.capture) return 'capture';
  return 'quiet';
}

const BAD = new Set(['mistake', 'blunder', 'miss']);
const ROUTINE = (r: PlyReview) => r.classification === 'forced' || r.features.recapture || (r.features.inCheckBefore && r.features.legalMoves <= 3);

function accuracyOf(rs: PlyReview[]): number | undefined {
  if (!rs.length) return undefined;
  return rs.reduce((a, r) => a + r.accuracy, 0) / rs.length;
}

/**
 * Read the minds behind a reviewed game. `plies` supplies clocks and client-side "considered" squares
 * when available; everything degrades gracefully without them.
 */
export function readMinds(review: GameReview, plies: PlyRecord[], meta: GameMeta = {}): MindReport {
  const frame = frameSeries(review.plies);
  const reads: MindRead[] = [];
  const evidence: Record<Side, Record<Archetype, string[]>> = {
    w: Object.fromEntries(ARCHETYPES.map((a) => [a, []])) as unknown as Record<Archetype, string[]>,
    b: Object.fromEntries(ARCHETYPES.map((a) => [a, []])) as unknown as Record<Archetype, string[]>,
  };
  const score: Record<Side, Record<Archetype, number>> = {
    w: Object.fromEntries(ARCHETYPES.map((a) => [a, 0])) as Record<Archetype, number>,
    b: Object.fromEntries(ARCHETYPES.map((a) => [a, 0])) as Record<Archetype, number>,
  };
  const add = (side: Side, a: Archetype, pts: number, why: string) => {
    score[side][a] += pts;
    if (evidence[side][a].length < 8) evidence[side][a].push(why);
  };

  const medians: Record<Side, number | undefined> = {
    w: median(plies.filter((p, i) => p.side === 'w' && i > 3 && p.thinkMs !== undefined).map((p) => p.thinkMs!)),
    b: median(plies.filter((p, i) => p.side === 'b' && i > 3 && p.thinkMs !== undefined).map((p) => p.thinkMs!)),
  };
  const lowClock = (ms?: number) =>
    ms !== undefined && ms < Math.max(20_000, 0.1 * (meta.initialMs ?? 600_000));
  const firstOutOfBook = review.lastBookPly + 1; // 0-based index of the first improvised ply
  const scriptBreakBy: Side | undefined = review.plies[firstOutOfBook]?.side;
  const outOfBookCount: Record<Side, number> = { w: 0, b: 0 };
  const pressureMoves: Record<Side, PlyReview[]> = { w: [], b: [] };
  const calmMoves: Record<Side, PlyReview[]> = { w: [], b: [] };
  const oobMoves: Record<Side, PlyReview[]> = { w: [], b: [] };
  let impulseErrors = { w: 0, b: 0 };
  let tilts = { w: 0, b: 0 };
  const scriptBreakPly: Partial<Record<Side, number>> = {};

  review.plies.forEach((r, i) => {
    const p = plies[i];
    const side = r.side;
    const tags: MindTag[] = [];
    const tag = (code: TagCode, lens: Lens, label: string, detail: string) => tags.push({ code, lens, label, detail });
    const at = `${moveNo(r.ply)} ${r.san}`;
    const style = styleOf(r.features);
    const med = medians[side];
    const thinkRatio = p?.thinkMs !== undefined && med ? p.thinkMs / Math.max(med, 250) : undefined;
    const prevFrame = frame[i - 1];
    const routine = ROUTINE(r);
    const inBook = r.classification === 'book';

    // ---- pressure context -------------------------------------------------------------------
    const pressureReasons: string[] = [];
    if (lowClock(p?.clockMs)) pressureReasons.push('low clock');
    const ownPrev = review.plies.slice(Math.max(0, i - 4), i).filter((x) => x.side === side);
    if (ownPrev.some((x) => BAD.has(x.classification))) pressureReasons.push('just made a mistake');
    if (prevFrame && prevFrame.state[side] === 'red') pressureReasons.push('lost the frame');
    if (!inBook && i >= firstOutOfBook && outOfBookCount[side] < 3 && review.lastBookPly >= 0) pressureReasons.push('fresh out of book');
    const pressure = pressureReasons.length > 0;
    if (!inBook && !routine) (pressure ? pressureMoves : calmMoves)[side].push(r);
    if (!inBook && i >= firstOutOfBook) {
      if (outOfBookCount[side] < 5) oobMoves[side].push(r);
      outOfBookCount[side]++;
    }

    // ---- FOCUS: scripts and attention ---------------------------------------------------------
    if (i === firstOutOfBook && review.lastBookPly >= 0) {
      scriptBreakPly[side] = r.ply;
      tag('script-break', 'focus', 'Left the script', `${at} is the first move outside named theory${review.opening ? ` (${review.opening.name})` : ''}. From here, nobody is reciting — the real player shows up.`);
    } else if (scriptBreakBy && scriptBreakBy !== side && i === firstOutOfBook + 1) {
      scriptBreakPly[side] = r.ply;
      tag('improvising', 'focus', 'Forced to improvise', `The opponent broke the script; this is your first move without a memorized answer${p?.thinkMs !== undefined ? ` (you spent ${fmtMs(p.thinkMs)})` : ''}.`);
    }
    if (thinkRatio !== undefined && thinkRatio >= 2.5 && p?.thinkMs! > 8000) {
      if (routine) {
        tag('overthink-routine', 'mask', 'Overthinking the obvious', `${fmtMs(p!.thinkMs!)} on a move the position practically forced. Needing certainty where none is required is an Intelligence tell.`);
        add(side, 'intelligence', 1.5, `${at} — long think on a routine move`);
      } else {
        tag('deep-think', 'focus', 'Deep think', `${fmtMs(p!.thinkMs!)} — ${thinkRatio.toFixed(1)}x your usual. This position had your full attention.`);
        add(side, 'intelligence', 0.8, `${at} — deep think`);
      }
    }
    if (r.classification === 'miss') {
      tag('missed-gift', 'focus', 'Missed the gift', `The opponent's last move was an error and ${r.bestSan ?? 'the best move'} would have punished it. Attention was on your own plan, not on what just changed.`);
    }
    const considered = p?.considered ?? [];
    if (new Set(considered).size >= 3) {
      tag('hesitation', 'focus', 'Hesitation', `You picked up ${new Set(considered).size} different pieces before committing.`);
    }
    if (r.bestUci && considered.includes(r.bestUci.slice(0, 2)) && r.uci.slice(0, 2) !== r.bestUci.slice(0, 2) && r.epLoss >= 0.05) {
      tag('abandoned-best', 'focus', 'You touched the answer', `You picked up the piece on ${r.bestUci.slice(0, 2)} — the best move (${r.bestSan}) was with that piece — then played something else. The instinct was right; the doubt was not.`);
    }

    // ---- EMOTION: impulse, tilt, pressure -----------------------------------------------------
    if (thinkRatio !== undefined && thinkRatio < 0.35 && !routine && !inBook && r.epLoss >= 0.05 && r.features.legalMoves > 5) {
      impulseErrors[side]++;
      tag('impulse', 'emotion', 'Impulse', `Played fast (${fmtMs(p!.thinkMs!)}) in a position that needed a look, and it cost ${(r.epLoss * 100).toFixed(0)} points of winning chances. Emotion chose; logic was not consulted.`);
    }
    if (ownPrev.some((x) => BAD.has(x.classification)) && r.epLoss >= 0.05) {
      tilts[side]++;
      tag('tilt', 'emotion', 'Tilt', 'A second error right after the first. The last mistake is still steering.');
      add(side, 'pity', 2, `${at} — error straight after an error`);
    }
    if (lowClock(p?.clockMs)) {
      if (r.epLoss >= 0.1) {
        tag('pressure-crack', 'emotion', 'Cracked under the clock', 'Low on time, the mask came off and the move fell apart. What you know under pressure is what you actually own.');
        add(side, 'pity', 1, `${at} — cracked in time trouble`);
      } else if (r.epLoss <= 0.02 && !routine) {
        tag('pressure-hold', 'authority', 'Held under the clock', 'Low on time and still accurate. That is identity, built in private, showing up in public.');
      }
    }

    // ---- FRAME: initiative --------------------------------------------------------------------
    const fp = frame[i];
    if (isReactive(r)) {
      tag('reactive', 'frame', 'Reactive', r.features.inCheckBefore ? 'Answering a check.' : r.features.recapture ? 'Taking back.' : 'Answering a threat.');
      if (fp.reactiveStreak === 3) {
        tag('frame-lost', 'frame', 'Frame lost', 'Three reactive moves in a row. You are only making forced moves now — the opponent is steering.');
        add(side, 'pity', 1, `${at} — third straight reactive move`);
      }
    }
    const impulse = impulseOf(r);
    if (impulse >= 1 && reactionOf(r) < 0.6 && prevFrame && (side === 'w' ? prevFrame.frame < -0.05 : prevFrame.frame > 0.05) && r.epLoss < 0.05) {
      tag('frame-seized', 'authority', 'Seized the frame', 'You stopped answering and started asking. The opponent must respond to you now.');
      add(side, 'strength', 1, `${at} — took the initiative back`);
    }
    const hadHanging = r.features.respondsToThreat === false && review.plies[i - 1]?.features.threatsCreated > 0;
    if (hadHanging && (r.features.check || r.features.threatsCreated > 0) && r.epLoss <= 0.05) {
      tag('counter-punch', 'authority', 'Counter-punch', 'Threatened, you answered with a bigger threat instead of defending.');
      add(side, 'strength', 1.5, `${at} — counter-attacked instead of defending`);
    }

    // ---- MASK: the choices that leak the archetype -------------------------------------------
    const aggressive = r.features.check || r.features.sacrifice || r.features.threatsCreated > 0 || r.features.pawnStorm;
    if (aggressive && r.epBefore < 0.4 && r.epLoss >= 0.08) {
      tag('loud-bluff', 'mask', 'Loud move, weak position', 'Aggression from a worse position that does not work. The mask is often the opposite of what it conceals: this is noise covering a position you sense is slipping.');
      add(side, 'significance', 1.5, `${at} — aggressive bluff from a worse position`);
    } else if ((r.features.sacrifice || r.features.check) && r.epLoss >= 0.05 && !routine) {
      tag('spectacle', 'mask', 'Playing for the spectacular', `A ${r.features.sacrifice ? 'sacrifice' : 'check'} when ${r.bestSan ?? 'a quieter move'} was better. Chosen for how it looks, not for what it does.`);
      add(side, 'significance', 1.5, `${at} — spectacular over correct`);
    }
    if (r.features.sacrifice && r.epLoss < 0.05) add(side, 'significance', 1, `${at} — sound sacrifice`);
    if (r.classification === 'brilliant' || r.classification === 'great') add(side, 'intelligence', 0.8, `${at} — found the ${r.classification} move`);
    if ((r.features.trade || r.features.tradeOffer) && !r.features.recapture && r.epBefore > 0.3 && r.epBefore < 0.8) {
      tag('safety-trade', 'tribe', 'Trading to safety', 'Offered or made an even trade in a balanced position: less tension, less risk of being wrong.');
      add(side, 'approval', 1, `${at} — even trade in a balanced position`);
    }
    if (r.features.retreat && !r.features.respondsToThreat && !r.features.inCheckBefore && !inBook) {
      tag('retreat-unprovoked', 'tribe', 'Unprovoked retreat', 'Pulled back without being pushed.');
      add(side, 'approval', 0.8, `${at} — retreat without a threat`);
    }
    if (inBook) add(side, 'acceptance', 0.35, `${at} — book move`);
    if ((r.features.castle || r.features.development) && !inBook) add(side, 'acceptance', 0.3, `${at} — textbook development`);
    if (r.features.pawnStorm && r.epLoss < 0.08) add(side, 'strength', 0.8, `${at} — pawn storm`);
    if ((r.features.threatsCreated > 0 || r.features.kingPressure >= 2) && !r.features.sacrifice) add(side, 'strength', 0.5, `${at} — created a threat`);

    // Free choice: two or more near-equal options. The position did not decide; the person did.
    const freeChoice = !inBook && !routine && r.epSecond !== undefined && r.epBefore - r.epSecond <= 0.03 && r.features.legalMoves > 3;
    if (freeChoice) {
      const leak: Partial<Record<MoveStyle, Archetype>> = {
        sacrifice: 'significance',
        attack: 'strength',
        'pawn-storm': 'strength',
        trade: 'approval',
        retreat: 'approval',
        develop: 'acceptance',
        quiet: 'intelligence',
      };
      const a = leak[style];
      if (a) {
        add(side, a, 1.2, `${at} — free choice: picked ${style}`);
        tag('free-choice', 'mask', 'Free choice', `At least two moves were equally good. You picked the ${style} option — when the position does not decide, your weighting does (${ARCHETYPE_INFO[a].title}).`);
      }
    }

    reads.push({ ply: r.ply, side, style, tags, thinkRatio, pressure, pressureReasons, freeChoice, why: explain(r, tags) });
  });

  // Resigning while still holding real chances is a Pity tell; never resigning when lost is not scored.
  if (meta.termination?.toLowerCase().includes('resign')) {
    const last = review.plies[review.plies.length - 1];
    const loser: Side | undefined = meta.result === '1-0' ? 'b' : meta.result === '0-1' ? 'w' : undefined;
    if (last && loser) {
      const loserEp = last.side === loser ? last.epAfter : 1 - last.epAfter;
      if (loserEp > 0.2) add(loser, 'pity', 2, 'resigned while still holding real chances');
    }
  }

  const share = initiativeShare(frame);
  const profile = (side: Side): PlayerProfile => {
    const own = review.plies.filter((r) => r.side === side);
    const sc = { ...score[side] };
    sc.strength += 3 * Math.max(0, (side === 'w' ? share.w : share.b) - 0.5);
    const total = ARCHETYPES.reduce((a, k) => a + sc[k], 0);
    const archetypes = Object.fromEntries(ARCHETYPES.map((a) => [a, total > 0 ? sc[a] / total : 1 / 6])) as Record<Archetype, number>;
    const ranked = [...ARCHETYPES].sort((a, b) => archetypes[b] - archetypes[a]);
    const accCalm = accuracyOf(calmMoves[side]);
    const accPressure = accuracyOf(pressureMoves[side]);
    const identity =
      accCalm !== undefined && accPressure !== undefined && pressureMoves[side].length >= 3
        ? Math.round(100 * Math.max(0, Math.min(1, accPressure / Math.max(accCalm, 1))))
        : undefined;
    return {
      side,
      name: side === 'w' ? meta.white : meta.black,
      archetypes,
      mask: [ranked[0], ranked[1]],
      evidence: evidence[side],
      identity,
      accuracyCalm: accCalm,
      accuracyPressure: accPressure,
      accuracyOutOfBook: accuracyOf(oobMoves[side]),
      initiativeShare: side === 'w' ? share.w : share.b,
      impulseErrors: impulseErrors[side],
      tiltEvents: tilts[side],
      scriptBreakPly: scriptBreakPly[side],
      medianThinkMs: medians[side],
      confidence: own.length >= 30 ? 'high' : own.length >= 15 ? 'medium' : 'low',
    };
  };

  return { reads, frame, white: profile('w'), black: profile('b'), keyMoments: keyMoments(review, frame, reads) };
}

function explain(r: PlyReview, tags: MindTag[]): string {
  const quality: Record<string, string> = {
    book: 'Theory — a memorized move.',
    brilliant: 'Brilliant: a sound sacrifice.',
    great: 'Great: the only move that held.',
    best: 'The engine’s top choice.',
    excellent: 'Excellent — essentially as good as the best.',
    good: 'Good, with a small concession.',
    inaccuracy: `Inaccuracy. ${r.bestSan ? `${r.bestSan} was better.` : ''}`,
    mistake: `Mistake. ${r.bestSan ? `${r.bestSan} was the move.` : ''}`,
    miss: `Missed chance. ${r.bestSan ? `${r.bestSan} punished the error.` : ''}`,
    blunder: `Blunder. ${r.bestSan ? `${r.bestSan} was necessary.` : ''}`,
    forced: 'Forced — the only legal move.',
  };
  const priority: TagCode[] = [
    'abandoned-best',
    'tilt',
    'impulse',
    'pressure-crack',
    'loud-bluff',
    'spectacle',
    'missed-gift',
    'frame-lost',
    'script-break',
    'improvising',
    'counter-punch',
    'frame-seized',
    'pressure-hold',
    'overthink-routine',
    'safety-trade',
    'free-choice',
    'deep-think',
    'retreat-unprovoked',
    'hesitation',
    'reactive',
  ];
  const top = priority.map((c) => tags.find((t) => t.code === c)).find(Boolean);
  return top ? `${quality[r.classification]} ${top.label}: ${top.detail}`.trim() : quality[r.classification].trim();
}

function keyMoments(review: GameReview, frame: FramePoint[], reads: MindRead[]): KeyMoment[] {
  const out: KeyMoment[] = [];
  const swings = [...review.plies].filter((r) => r.epLoss >= 0.1).sort((a, b) => b.epLoss - a.epLoss).slice(0, 4);
  for (const r of swings) {
    const read = reads[r.ply - 1];
    out.push({
      ply: r.ply,
      side: r.side,
      kind: 'swing',
      title: `${moveNo(r.ply)} ${r.san} — ${r.classification}`,
      detail: `${(r.epLoss * 100).toFixed(0)} points of winning chances gone. ${read.why}`,
    });
  }
  const sb = reads.find((x) => x.tags.some((t) => t.code === 'script-break'));
  if (sb) out.push({ ply: sb.ply, side: sb.side, kind: 'script-break', title: `${moveNo(sb.ply)} ${review.plies[sb.ply - 1].san}`, detail: sb.tags.find((t) => t.code === 'script-break')!.detail });
  for (let i = 1; i < frame.length; i++) {
    if (Math.sign(frame[i].frame) !== Math.sign(frame[i - 1].frame) && Math.abs(frame[i].frame) > 0.2) {
      const r = review.plies[i];
      out.push({ ply: r.ply, side: r.side, kind: 'frame-flip', title: `${moveNo(r.ply)} ${r.san} — frame flips`, detail: `${r.side === 'w' ? 'White' : 'Black'} took over the initiative.` });
    }
  }
  return out.sort((a, b) => a.ply - b.ply);
}
