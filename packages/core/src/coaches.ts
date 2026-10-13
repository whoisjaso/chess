import type { MindRead, TagCode } from './mind';
import type { PlyReview } from './review';
import type { Archetype, Classification } from './types';

/**
 * Coach personas: original teachers modelled on fictional geniuses' *minds*: how they think, not
 * their names, art or lines. `inspiredBy` documents the influence; display names are original so the
 * project stays clean to fork and redistribute. Rename locally via `renameCoach` if you want.
 *
 * Each coach owns a lens of the psychology system and comments on moves in their own voice.
 */
export type Moment = Classification | TagCode | 'summary-high' | 'summary-low';

export interface CoachPersona {
  id: string;
  name: string;
  title: string;
  inspiredBy: string;
  /** The archetype the coach embodies or has mastered. */
  embodies: Archetype | 'identity';
  philosophy: string;
  /** Lessons this coach teaches. */
  teaches: string[];
  /** Bot persona used when you spar against this coach. */
  sparsAs: string;
  /** Templates: {move} = move played, {best} = engine move, {loss} = winning chances lost (%). */
  voice: Partial<Record<Moment, string[]>>;
}

export const COACHES: CoachPersona[] = [
  {
    id: 'kiyo',
    name: 'Kiyo',
    title: 'The Hidden Student',
    inspiredBy: 'Kiyotaka Ayanokoji (Classroom of the Elite)',
    embodies: 'identity',
    philosophy: 'Show nothing. Need nothing from the audience. Every piece, including you, is a tool. Identity is what remains when no one is watching.',
    teaches: ['mind-clock', 'mind-frame'],
    sparsAs: 'professor',
    voice: {
      blunder: ['{move}. You wanted to end it quickly. Wanting is a leak. {best} was available.', 'Careless. {best}. Nothing else matters about this move.'],
      mistake: ['{move} cost {loss}%. You reacted to the board you hoped for, not the one in front of you.'],
      best: ['Correct. Do not enjoy it.'],
      brilliant: ['You gave up material to own the position. Good. Most people cannot let go of what they hold.'],
      tilt: ['You are still playing the last move. The position has already forgotten it. So should you.'],
      'frame-lost': ['Three answers in a row. You are no longer playing; you are being played.'],
      'pressure-hold': ['Low clock, same quality. That is the only kind of confidence that counts.'],
      'pressure-crack': ['The clock took the mask off. Now you know what you actually own.'],
      'summary-high': ['You played the same under pressure as at rest. That is identity. Keep it unwatched.'],
      'summary-low': ['Your calm moves were someone else. Your pressured moves were you. Train the second one, alone.'],
    },
  },
  {
    id: 'lumen',
    name: 'Lumen',
    title: 'The Planner',
    inspiredBy: 'Light Yagami (Death Note)',
    embodies: 'significance',
    philosophy: 'Plan ten moves ahead and let them walk into it. But know the trap that kills planners: needing to be seen as the one who planned it.',
    teaches: ['knight-fork', 'skewer'],
    sparsAs: 'showman',
    voice: {
      brilliant: ['Exactly as planned. They never saw the sacrifice as a gift — they saw it as a mistake.'],
      great: ['The only move. Of course you found it.'],
      spectacle: ['{move} was theatre. {best} wins quietly — and quiet wins are still wins. Pride writes its own downfall.'],
      'loud-bluff': ['You are shouting because the position is whispering that you are losing. They will hear the whisper.'],
      miss: ['They handed you the game and you were too busy admiring your own plan. {best}.'],
      blunder: ['{move}. A god does not leave fingerprints. {best} was the clean path.'],
      'summary-high': ['A calculated game. Remember: the perfect plan fails the moment you need applause for it.'],
      'summary-low': ['Your plans were good until you needed them to be impressive.'],
    },
  },
  {
    id: 'karasu',
    name: 'Karasu',
    title: 'The Crow',
    inspiredBy: 'Itachi Uchiha (Naruto)',
    embodies: 'pity',
    philosophy: 'Carry the burden silently. Sacrifice what must be sacrificed. Illusions only work on those who believe what they want to see.',
    teaches: ['mind-tilt', 'mind-read-opponent'],
    sparsAs: 'underdog',
    voice: {
      brilliant: ['You let them take it. They will believe they won something. That belief is the illusion.'],
      tilt: ['Forgive the last move. Carrying it only adds weight to this one.'],
      'safety-trade': ['You traded to feel safe. Safety bought with the position is a loan, not a gift.'],
      'missed-gift': ['You were looking at your own pain. The opening they gave you was right there.'],
      blunder: ['{move}. Do not punish yourself — learn {best}, and move on.'],
      'summary-high': ['You stayed steady when it hurt. That is strength no one sees, and the only kind that lasts.'],
      'summary-low': ['When it went wrong, you made it your story. The board does not care about your story.'],
    },
  },
  {
    id: 'tenka',
    name: 'Tenka',
    title: 'The Conqueror',
    inspiredBy: 'Madara Uchiha (Naruto)',
    embodies: 'strength',
    philosophy: 'Initiative is everything. Make them answer you. But power that cannot wait is just another mask.',
    teaches: ['mind-frame', 'ladder-mate'],
    sparsAs: 'warlord',
    voice: {
      'frame-seized': ['Now they kneel to your questions. Keep asking.'],
      'frame-lost': ['You are answering. Conquerors do not answer.'],
      'counter-punch': ['Threatened, you threatened back harder. Good. Defence is for those who accept the frame.'],
      reactive: ['A forced move. Fine — but find the moment to take the frame back.'],
      'retreat-unprovoked': ['Retreating from nothing. Who taught you to fear the empty square?'],
      blunder: ['{move}. Strength without patience. {best} kept everything.'],
      'summary-high': ['You held the frame. Now learn when not to swing.'],
      'summary-low': ['You attacked to feel powerful, not because the position asked for it.'],
    },
  },
  {
    id: 'flint',
    name: 'Doc Flint',
    title: 'The Scientist',
    inspiredBy: 'Senku Ishigami (Dr. Stone)',
    embodies: 'intelligence',
    philosophy: 'Chess is a science. Hypothesis, calculation, verification. Ten billion percent sure — or keep calculating.',
    teaches: ['opposition', 'promotion', 'value-of-pieces', 'opening-principles'],
    sparsAs: 'professor',
    voice: {
      best: ['Verified. Textbook.'],
      excellent: ['Within margin of error. Science approves.'],
      inaccuracy: ['Hypothesis {move}: partially wrong. {best} tests better by {loss}%.'],
      mistake: ['Experiment failed: {loss}% of winning chances evaporated. Control variable: {best}.'],
      blunder: ['{move}? That broke the laws of physics. {best} was the only sane result.'],
      'overthink-routine': ['You re-ran an experiment with a known result. The recapture was obvious — save the clock for real unknowns.'],
      impulse: ['No calculation, no conclusion. You guessed. Science does not guess.'],
      'summary-high': ['Clean data. Repeatable results. That is how you build a civilization — and a rating.'],
      'summary-low': ['Your method held in calm positions and broke under load. Stress-test your process.'],
    },
  },
  {
    id: 'shuji',
    name: 'Shūji',
    title: 'The Reader',
    inspiredBy: 'Osamu Dazai (Bungo Stray Dogs)',
    embodies: 'approval',
    philosophy: 'Everyone wears a mask, and every mask has a seam. Read the person; the board follows.',
    teaches: ['mind-read-opponent', 'mind-out-of-book'],
    sparsAs: 'diplomat',
    voice: {
      'script-break': ['Ah, the script ends here. Now we see who they really are. How exciting.'],
      improvising: ['They pushed you off the page. Watch your own hands now — they reveal more than theirs.'],
      'free-choice': ['Two equal moves, and you chose that one. Interesting. That choice is your mask showing.'],
      'safety-trade': ['You traded because a quiet board cannot embarrass you. I noticed. So did they.'],
      'abandoned-best': ['You touched the right piece, then doubted yourself. Instinct read the board; fear chose the move.'],
      hesitation: ['Picking up piece after piece. Indecision is information — for your opponent.'],
      'summary-high': ['You hid your seams well. Almost.'],
      'summary-low': ['You played for their approval. They did not give it. The board never does.'],
    },
  },
  {
    id: 'namenlos',
    name: 'Herr Namenlos',
    title: 'The Nameless',
    inspiredBy: 'Johan Liebert (Monster)',
    embodies: 'acceptance',
    philosophy: 'A person with no mask is terrifying because nothing moves them. Most people are only the masks others gave them.',
    teaches: ['mind-out-of-book', 'mind-clock'],
    sparsAs: 'bookworm',
    voice: {
      book: ['Someone else’s move. Whose game are you playing?'],
      'script-break': ['The book is closed. Who is left?'],
      'pressure-crack': ['There it is. The person under the mask. Frightened, aren’t they?'],
      'loud-bluff': ['Noise. You make noise when you are afraid of the silence.'],
      tilt: ['One wound and you bleed everywhere.'],
      'summary-high': ['Nothing moved you today. That is rare.'],
      'summary-low': ['You were whoever the position told you to be.'],
    },
  },
];

function fill(t: string, r: PlyReview): string {
  return t
    .replaceAll('{move}', r.san)
    .replaceAll('{best}', r.bestSan ?? 'the engine move')
    .replaceAll('{loss}', String(Math.round(r.epLoss * 100)));
}

/** Pick what this coach would say about a move, preferring their lens (tags) over generic quality. */
export function coachSay(coach: CoachPersona, r: PlyReview, read: MindRead, seed = r.ply): string | undefined {
  const options: Moment[] = [...read.tags.map((t) => t.code), r.classification];
  for (const m of options) {
    const lines = coach.voice[m];
    if (lines?.length) return fill(lines[seed % lines.length], r);
  }
  return undefined;
}

export function coachSummary(coach: CoachPersona, identity: number | undefined): string {
  const key: Moment = identity !== undefined && identity < 80 ? 'summary-low' : 'summary-high';
  return coach.voice[key]?.[0] ?? coach.philosophy;
}

export function renameCoach(id: string, name: string): void {
  const c = COACHES.find((x) => x.id === id);
  if (c) c.name = name;
}
