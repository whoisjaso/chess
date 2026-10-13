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
  /** In-game chat, in character. The mask talks, too. */
  chat: Record<BotMoment, string[]>;
}

export type BotMoment = 'greet' | 'check' | 'capture' | 'winning' | 'losing' | 'win' | 'lose' | 'draw';

/** Pick a chat line for a moment (deterministic per seed). */
export function botSays(bot: BotPersona, moment: BotMoment, seed = Math.floor(Math.random() * 1000)): string {
  const lines = bot.chat[moment];
  return lines[seed % lines.length];
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
    chat: {
      greet: ['Lights, camera… sacrifice. Let’s give them a show.', 'I don’t play for draws. I play for the highlight reel.'],
      check: ['Check! Did everyone see that?', 'Feel the spotlight?'],
      capture: ['Material is temporary. Style is forever.', 'I’ll take that — for the drama.'],
      winning: ['This is going in my best-games collection.', 'The crowd is on its feet.'],
      losing: ['A true artist suffers for his work.', 'Fine. I’ll need something spectacular now.'],
      win: ['And THAT is how you finish with style.', 'Encore!'],
      lose: ['You won… but was it beautiful?', 'Nobody remembers the quiet winners. Except today.'],
      draw: ['A draw? How dreadfully ordinary.'],
    },
  },
  {
    id: 'diplomat',
    name: 'The Diplomat',
    archetype: 'approval',
    blurb: 'Trades pieces, keeps it safe, would love a draw. Hates tension.',
    tolerance: 0.05,
    style: { trade: 3, retreat: 1, quiet: 1, sacrifice: -3, 'pawn-storm': -1.5 },
    bookLoyalty: 0.6,
    chat: {
      greet: ['Let’s keep this friendly, shall we?', 'I’m sure we can find a fair outcome.'],
      check: ['Pardon the intrusion.', 'Just a polite check.'],
      capture: ['Shall we trade? Fair is fair.', 'Even exchange — everyone’s happy.'],
      winning: ['I didn’t mean to get ahead, honestly.', 'Perhaps we simplify from here.'],
      losing: ['Would you consider a draw?', 'Oh dear. That wasn’t very safe of me.'],
      win: ['Well played — truly, it could have gone either way.'],
      lose: ['Congratulations. I hope I was a good opponent.'],
      draw: ['A draw! The perfect outcome.'],
    },
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
    chat: {
      greet: ['I’ve read every line of this opening. Every single one.', 'Theory says I’m fine. Theory is never wrong.'],
      check: ['Page 214, footnote 3.', 'As the manuals recommend.'],
      capture: ['Standard recapture. Textbook.', 'This is all in the book.'],
      winning: ['Exactly as the grandmaster games went.', 'Following the main line to victory.'],
      losing: ['That move isn’t in my book…', 'Wait, where is this in the theory?'],
      win: ['Theory wins again.'],
      lose: ['You weren’t supposed to play that. It’s not in the book!'],
      draw: ['A theoretical draw. Acceptable.'],
    },
  },
  {
    id: 'professor',
    name: 'The Professor',
    archetype: 'intelligence',
    blurb: 'Calculates everything. Plays the most correct move, rarely the most practical one.',
    tolerance: 0.015,
    style: { quiet: 1.5 },
    bookLoyalty: 0.5,
    chat: {
      greet: ['Let us proceed methodically.', 'I have calculated the first few possibilities. Shall we?'],
      check: ['Check. As calculated.', 'The geometry demanded it.'],
      capture: ['Correct, by a margin of 0.3 pawns.', 'The numbers favoured that capture.'],
      winning: ['The evaluation is unambiguous.', 'You may wish to recalculate your last move.'],
      losing: ['Hm. I must have missed a variation.', 'Interesting. Let me think about that… for a while.'],
      win: ['Q.E.D.'],
      lose: ['Fascinating. I will need to review this.'],
      draw: ['A logically consistent result.'],
    },
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
    chat: {
      greet: ['Please go easy on me… I’ll try my best.', 'I’m not very good, but I love this game.'],
      check: ['Oh! I got a check!', 'Is… is that allowed? It is? Great!'],
      capture: ['Sorry! I had to.', 'Oh, I took something!'],
      winning: ['Wait, am I actually winning?', 'Don’t jinx it, don’t jinx it…'],
      losing: ['Of course. This always happens to me.', 'Why does everything go wrong at once?'],
      win: ['I… won? I WON!'],
      lose: ['I knew it. I always lose these.'],
      draw: ['A draw! That’s practically a win for me.'],
    },
  },
  {
    id: 'warlord',
    name: 'The Warlord',
    archetype: 'strength',
    blurb: 'Attacks relentlessly. Never retreats. Gives you the initiative only by force.',
    tolerance: 0.07,
    style: { attack: 3, 'pawn-storm': 2, sacrifice: 1, retreat: -3, trade: -1, defend: -1 },
    bookLoyalty: 0.3,
    chat: {
      greet: ['Kneel or be crushed.', 'I do not retreat. Ever.'],
      check: ['Your king trembles.', 'CHECK. Answer me.'],
      capture: ['Spoils of war.', 'Another one falls.'],
      winning: ['Your defences crumble.', 'Surrender is an option. For you.'],
      losing: ['A temporary setback. ATTACK!', 'Retreat? Never. More pawns forward!'],
      win: ['Conquered.'],
      lose: ['You fought well. Next time I bring more pawns.'],
      draw: ['A ceasefire. For now.'],
    },
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
