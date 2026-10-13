import { Chess } from 'chess.js';
import { expectedPoints, lineToCp } from './evaluation';
import { extractFeatures } from './features';
import { styleOf, type MoveStyle } from './mind';
import { bookContinuations } from './openings';
import type { Archetype, EngineLine } from './types';

/**
 * Bots with a mask. Chess.com's bots are personalities layered on an engine; ours wear one of the
 * six archetypes, so you can practise reading (and exploiting) each one. Each bot asks the engine for
 * several candidate moves, keeps the ones within its tolerance, and picks by its style weighting.
 */
export interface BotPersona {
  id: string;
  name: string;
  archetype: Archetype;
  blurb: string;
  /** Max expected points the bot will give up for a move it likes. */
  tolerance: number;
  style: Partial<Record<MoveStyle, number>>;
  /** Probability of following named theory when available. */
  bookLoyalty: number;
  /** Extra tolerance once the bot is clearly worse (simulates a mask cracking). */
  crackWhenLosing?: number;
}

export const BOTS: BotPersona[] = [
  {
    id: 'showman',
    name: 'The Showman',
    archetype: 'significance',
    blurb: 'Wants the brilliancy. Will sacrifice for the crowd even when the quiet move is better.',
    tolerance: 0.08,
    style: { sacrifice: 3, attack: 2, 'pawn-storm': 1, trade: -1.5, retreat: -1.5 },
    bookLoyalty: 0.3,
  },
  {
    id: 'diplomat',
    name: 'The Diplomat',
    archetype: 'approval',
    blurb: 'Trades pieces, keeps it safe, would love a draw. Hates tension.',
    tolerance: 0.05,
    style: { trade: 3, retreat: 1, quiet: 1, sacrifice: -3, 'pawn-storm': -1.5 },
    bookLoyalty: 0.6,
  },
  {
    id: 'bookworm',
    name: 'The Bookworm',
    archetype: 'acceptance',
    blurb: 'Knows the theory cold. Take it out of book and watch what happens.',
    tolerance: 0.04,
    style: { develop: 2, quiet: 1, sacrifice: -2 },
    bookLoyalty: 1,
    crackWhenLosing: 0.08,
  },
  {
    id: 'professor',
    name: 'The Professor',
    archetype: 'intelligence',
    blurb: 'Calculates everything. Plays the most correct move, rarely the most practical one.',
    tolerance: 0.015,
    style: { quiet: 1.5 },
    bookLoyalty: 0.5,
  },
  {
    id: 'underdog',
    name: 'The Underdog',
    archetype: 'pity',
    blurb: 'Solid while things go well. One setback and the wheels come off.',
    tolerance: 0.03,
    style: { defend: 1, retreat: 1 },
    bookLoyalty: 0.6,
    crackWhenLosing: 0.2,
  },
  {
    id: 'warlord',
    name: 'The Warlord',
    archetype: 'strength',
    blurb: 'Attacks relentlessly. Never retreats. Gives you the initiative only by force.',
    tolerance: 0.07,
    style: { attack: 3, 'pawn-storm': 2, sacrifice: 1, retreat: -3, trade: -1, defend: -1 },
    bookLoyalty: 0.3,
  },
];

/** Strength levels: extra tolerance added on top of the persona's own. */
export const BOT_LEVELS = [
  { id: 1, label: 'Beginner (~600)', extraTolerance: 0.3, depth: 4 },
  { id: 2, label: 'Casual (~1000)', extraTolerance: 0.15, depth: 6 },
  { id: 3, label: 'Club (~1400)', extraTolerance: 0.07, depth: 9 },
  { id: 4, label: 'Strong (~1800)', extraTolerance: 0.03, depth: 12 },
  { id: 5, label: 'Expert (~2200)', extraTolerance: 0.01, depth: 15 },
  { id: 6, label: 'Master (2500+)', extraTolerance: 0, depth: 18 },
];

export function chooseBotMove(
  fen: string,
  lines: EngineLine[],
  persona: BotPersona,
  level: (typeof BOT_LEVELS)[number],
  rng: () => number = Math.random,
): string {
  const book = bookContinuations(fen);
  if (book.length && rng() < persona.bookLoyalty) return book[Math.floor(rng() * book.length)].uci;
  if (!lines.length) {
    const c = new Chess(fen);
    const m = c.moves({ verbose: true });
    const pick = m[Math.floor(rng() * m.length)];
    return pick.from + pick.to + (pick.promotion ?? '');
  }
  const eps = lines.map((l) => expectedPoints(lineToCp(l)));
  const best = eps[0];
  let tolerance = persona.tolerance + level.extraTolerance;
  if (persona.crackWhenLosing && best < 0.35) tolerance += persona.crackWhenLosing;
  let bestScore = -Infinity;
  let choice = lines[0].move;
  lines.forEach((l, i) => {
    const loss = best - eps[i];
    if (loss > tolerance) return;
    const style = styleOf(extractFeatures(fen, l.move));
    const score = -loss * 20 + (persona.style[style] ?? 0) + rng() * 1.5;
    if (score > bestScore) {
      bestScore = score;
      choice = l.move;
    }
  });
  return choice;
}
