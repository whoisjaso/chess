/**
 * Lessons. Chess.com's lesson format (reverse engineered): a short video or text, then a sequence of
 * "challenge" positions where the learner must find the move; the opponent's reply is auto-played,
 * and the lesson advances. We keep that loop and add a Mind track that trains the player, not the board.
 *
 * Every exercise is validated by packages/core/test/lessons.test.ts (legal moves, mates really mate).
 */
export type Track = 'Foundations' | 'Tactics' | 'Checkmates' | 'Openings' | 'Endgames' | 'Mind';

export interface MoveTask {
  /** Any of these UCI moves solves the step. */
  accept: string[];
  /** Opponent's automatic reply (UCI) after a correct move. */
  reply?: string;
  hint?: string;
}

export interface LessonStep {
  text: string;
  fen?: string;
  /** Moves the learner must find, in order. Omit for a read-only step. */
  tasks?: MoveTask[];
  /** What the final position must be. */
  goal?: 'mate' | 'any';
  orientation?: 'white' | 'black';
}

export interface Lesson {
  id: string;
  track: Track;
  title: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  summary: string;
  steps: LessonStep[];
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const LESSONS: Lesson[] = [
  {
    id: 'value-of-pieces',
    track: 'Foundations',
    title: 'What the pieces are worth',
    level: 'beginner',
    summary: 'Pawn 1, knight 3, bishop 3, rook 5, queen 9. The king is priceless.',
    steps: [
      { text: 'Every trade is a negotiation. Count before you capture: pawn = 1, knight = 3, bishop = 3, rook = 5, queen = 9.', fen: START },
      {
        text: 'The center is the high ground. Claim it with a pawn: push the e-pawn or the d-pawn two squares.',
        fen: START,
        tasks: [{ accept: ['e2e4', 'd2d4'], hint: 'Center pawns: e or d file.' }],
      },
    ],
  },
  {
    id: 'knight-fork',
    track: 'Tactics',
    title: 'The knight fork',
    level: 'beginner',
    summary: 'One knight, two targets. Check the king and the rook falls.',
    steps: [
      { text: 'A fork attacks two things at once. The opponent can only save one.', fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1' },
      {
        text: 'Find the square where your knight checks the king and attacks the rook — then collect.',
        fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1',
        tasks: [{ accept: ['b5c7'], reply: 'e8d7', hint: 'Look at c7.' }, { accept: ['c7a8'] }],
      },
    ],
  },
  {
    id: 'skewer',
    track: 'Tactics',
    title: 'The skewer',
    level: 'beginner',
    summary: 'Attack the valuable piece in front; take the one hiding behind it.',
    steps: [
      {
        text: 'The king stands in front of its queen on the e-file. Check it from below — when the king steps aside, the queen is yours.',
        fen: '4q3/8/8/4k3/8/8/8/R6K w - - 0 1',
        tasks: [{ accept: ['a1e1'], reply: 'e5d4', hint: 'Put the rook on the e-file.' }, { accept: ['e1e8'] }],
      },
    ],
  },
  {
    id: 'back-rank',
    track: 'Checkmates',
    title: 'Back-rank mate',
    level: 'beginner',
    summary: 'A king behind its own pawns has no exits.',
    steps: [
      {
        text: 'Black castled and never made an escape square. Deliver mate in one.',
        fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
        tasks: [{ accept: ['a1a8'] }],
        goal: 'mate',
      },
    ],
  },
  {
    id: 'queen-mate',
    track: 'Checkmates',
    title: 'King and queen mate',
    level: 'beginner',
    summary: 'The queen controls the edge; the king takes away the last squares.',
    steps: [
      {
        text: 'Your king already covers g7 and h7. One queen move finishes it.',
        fen: '7k/8/6K1/8/8/8/8/Q7 w - - 0 1',
        tasks: [{ accept: ['a1a8'] }],
        goal: 'mate',
      },
    ],
  },
  {
    id: 'ladder-mate',
    track: 'Checkmates',
    title: 'The ladder',
    level: 'beginner',
    summary: 'Two rooks walk the king to the edge, one rank at a time.',
    steps: [
      {
        text: 'Cut the king off on the 7th rank with one rook, then mate on the 8th with the other.',
        fen: '4k3/8/8/8/8/8/R7/1R4K1 w - - 0 1',
        tasks: [{ accept: ['b1b7'], reply: 'e8f8', hint: 'Rook to the 7th rank.' }, { accept: ['a2a8'] }],
        goal: 'mate',
      },
    ],
  },
  {
    id: 'opening-principles',
    track: 'Openings',
    title: 'Opening principles: the Italian Game',
    level: 'beginner',
    summary: 'Center, develop, castle. The oldest script in chess — learn it, then learn when it ends.',
    steps: [
      {
        text: 'Take the center, develop the knight toward it, then aim the bishop at f7 — the weakest point in Black’s camp.',
        fen: START,
        tasks: [
          { accept: ['e2e4'], reply: 'e7e5' },
          { accept: ['g1f3'], reply: 'b8c6', hint: 'Develop a knight and attack e5.' },
          { accept: ['f1c4'], reply: 'f8c5', hint: 'Bishop to the diagonal that hits f7.' },
          { accept: ['e1g1'], hint: 'King to safety.' },
        ],
      },
      {
        text: 'That is the Italian Game, "in book". Book moves are a script: they show what you memorized, not who you are. The Mind track teaches what to do when the script runs out.',
      },
    ],
  },
  {
    id: 'promotion',
    track: 'Endgames',
    title: 'Promotion',
    level: 'beginner',
    summary: 'A pawn that reaches the last rank becomes a queen.',
    steps: [{ text: 'Promote the pawn.', fen: '8/4P3/8/8/8/8/k7/4K3 w - - 0 1', tasks: [{ accept: ['e7e8q'] }] }],
  },
  {
    id: 'opposition',
    track: 'Endgames',
    title: 'The opposition',
    level: 'intermediate',
    summary: 'In king-and-pawn endings, the side that does NOT have to move often wins.',
    steps: [
      {
        text: 'Kings facing each other with one square between them: whoever must move gives way. This is zugzwang — every option worsens your position. Black to move here must let the white king through.',
        fen: '8/8/4k3/8/4K3/4P3/8/8 b - - 0 1',
      },
      {
        text: 'Take the opposition: put your king directly in front of Black’s, one square apart.',
        fen: '8/4k3/8/8/4K3/4P3/8/8 w - - 0 1',
        tasks: [{ accept: ['e4e5'], hint: 'Face the king on the same file.' }],
      },
    ],
  },
  // ------------------------------------------------------------------ the Mind track
  {
    id: 'mind-frame',
    track: 'Mind',
    title: 'Frame: whoever asks the questions',
    level: 'intermediate',
    summary: 'Initiative is frame. The side making threats steers; the side answering them follows.',
    steps: [
      {
        text: 'In chess, as on a sales call, whoever makes the threats holds the initiative. Every forced reply is the other side handing over the frame. The Frame bar in Review shows who is asking and who is answering.',
      },
      {
        text: 'Your queen is attacked by the knight on f6. The reactive instinct is to retreat. Ignore the question — ask a bigger one.',
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        tasks: [{ accept: ['h5f7'], hint: 'Which square is defended only by the king?' }],
        goal: 'mate',
      },
      {
        text: 'Rule: before you defend, check whether you have a forcing move — check, capture, or threat. Three reactive moves in a row and Review will mark you red: frame lost.',
      },
    ],
  },
  {
    id: 'mind-out-of-book',
    track: 'Mind',
    title: 'Out of book: where the real player appears',
    level: 'intermediate',
    summary: 'Openings are memorized scripts. Interrupt the script and the person underneath shows up.',
    steps: [
      {
        text: 'Opening theory is the social script of chess. Inside it, everyone looks strong. The moment the lines run out, players have to think — and their real understanding (or panic) shows.',
      },
      {
        text: 'Review marks the first improvised move as a SCRIPT BREAK and compares your accuracy just after it with your game average. A big gap means your opening is borrowed, not built.',
      },
      {
        text: 'After 1.e4 e5 2.Nc3, Black left theory with 2...Qh4?! instead of a normal developing move. No memorized answer: think in principles. Develop with tempo by attacking the queen.',
        fen: 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3',
        tasks: [{ accept: ['g1f3', 'g2g3', 'd2d3'], hint: 'Develop a piece. The knight to f3 hits the queen.' }],
      },
      {
        text: 'Elicitation works the same way on a call: pattern-interrupt the prospect’s script and you will see the real weighting underneath. On the board, do it with an offbeat line by move five.',
      },
    ],
  },
  {
    id: 'mind-tilt',
    track: 'Mind',
    title: 'Tilt: the move after the mistake',
    level: 'intermediate',
    summary: 'The most dangerous move in chess is the one right after your last mistake.',
    steps: [
      {
        text: 'Emotion decides; logic justifies afterward. After a mistake, the next move is usually played by the feeling of the mistake, not by the position. Review tags this as TILT.',
      },
      {
        text: 'Drill: after any error, take one full breath, say "new position" and evaluate from zero. The position does not know how it got here.',
      },
      {
        text: 'Pattern to watch: Pity-mask players collapse after one setback and resign early. Strength-mask players over-press to win it back immediately. Both are the last mistake still steering.',
      },
    ],
  },
  {
    id: 'mind-clock',
    track: 'Mind',
    title: 'Time pressure strips the mask',
    level: 'advanced',
    summary: 'What you play with ten seconds left is what you actually own.',
    steps: [
      {
        text: 'Confidence from your rating, a recent win, or the crowd is ego: it is borrowed and recomputes for every audience. Confidence from thousands of private hours is identity.',
      },
      {
        text: 'The clock is the test. Review computes your IDENTITY INDEX: accuracy under pressure (low clock, just after a mistake, lost frame, fresh out of book) divided by accuracy when calm. 90+ means it holds. Under 70 means the mask is doing the work.',
      },
      { text: 'Training: identity is built when nobody is watching. Unrated puzzles, slow solo study, endgame drills — reps without an audience.' },
    ],
  },
  {
    id: 'mind-read-opponent',
    track: 'Mind',
    title: 'Reading the opponent’s mask',
    level: 'advanced',
    summary: 'Lasker played the person, not just the board. Six masks, six counters.',
    steps: [
      { text: 'SIGNIFICANCE (the Showman) hunts brilliancies. Counter: stay solid, decline the spectacle, let the unsound sacrifice fail.' },
      { text: 'APPROVAL (the Diplomat) trades into safety. Counter: keep the tension, avoid exchanges, make them choose.' },
      { text: 'ACCEPTANCE (the Bookworm) lives in theory. Counter: leave the book early. The real player is weaker than the script.' },
      { text: 'INTELLIGENCE (the Professor) needs certainty. Counter: create messy, unclear positions and let the clock do the work.' },
      { text: 'PITY (the Underdog) collapses after a setback. Counter: win a small edge early and keep the pressure steady.' },
      { text: 'STRENGTH (the Warlord) cannot stand passivity. Counter: prophylaxis. Absorb the attack; the over-extension comes.' },
      { text: 'Sacrifice tip: let every small victory belong to them and keep the board. Give the Intelligence player the "clever" pawn; keep the initiative.' },
    ],
  },
];

export function lessonsByTrack(): Record<Track, Lesson[]> {
  const out = {} as Record<Track, Lesson[]>;
  for (const l of LESSONS) (out[l.track] ??= []).push(l);
  return out;
}
