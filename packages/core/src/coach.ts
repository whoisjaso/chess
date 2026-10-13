import { ARCHETYPE_INFO, type MindReport, type PlayerProfile } from './mind';
import type { GameReview } from './review';
import type { Archetype, Side } from './types';

/**
 * The coach turns the engine (board) and the mind engine (player) into language.
 * Deterministic and offline: no account, no server, no API key. An LLM can be layered on top
 * (see docs/03-architecture.md), but the free baseline must stand on its own.
 */

/** One drill per mask: ego work = name the script, then rebuild identity through unwatched reps. */
export const PRESCRIPTIONS: Record<Archetype, { script: string; drill: string }> = {
  significance: {
    script: '"I need this game to look brilliant."',
    drill: 'Before any sacrifice or check, name the quiet alternative out loud. Play five games where the goal is zero unsound sacrifices.',
  },
  approval: {
    script: '"If I keep it safe, nobody can say I played badly."',
    drill: 'In balanced positions, find one move that keeps the tension before you consider a trade. Ban voluntary trades for three games.',
  },
  acceptance: {
    script: '"I play what the book says."',
    drill: 'Play an offbeat line that leaves theory by move five. Your goal is to think, not to remember.',
  },
  intelligence: {
    script: '"I have to be sure before I move."',
    drill: 'Cap obvious moves at ten seconds. Spend your clock only at script breaks and critical positions.',
  },
  pity: {
    script: '"It’s already going wrong."',
    drill: 'After any mistake, take one full breath and re-evaluate from zero before the next move. Play out lost positions against The Warlord.',
  },
  strength: {
    script: '"If I’m not attacking, I’m losing."',
    drill: 'Before every attacking move, ask "what does my opponent want?" Play three games against The Diplomat and win without a pawn storm.',
  },
};

export interface CoachReport {
  headline: string;
  paragraphs: string[];
  forPlayer: Record<Side, { mask: string; identity: string; prescription: string; script: string }>;
}

const pct = (x?: number) => (x === undefined ? '—' : `${Math.round(x)}%`);
const name = (side: Side, p: PlayerProfile) => p.name ?? (side === 'w' ? 'White' : 'Black');

export function identityLine(p: PlayerProfile): string {
  if (p.identity === undefined) return 'Not enough pressure moments to measure identity this game.';
  if (p.identity >= 90)
    return `Identity held: ${pct(p.accuracyPressure)} accuracy under pressure vs ${pct(p.accuracyCalm)} when calm. What you know, you own.`;
  if (p.identity >= 70)
    return `Identity wobbled: ${pct(p.accuracyPressure)} under pressure vs ${pct(p.accuracyCalm)} calm. Part of your play is borrowed confidence.`;
  return `Ego game: ${pct(p.accuracyPressure)} under pressure vs ${pct(p.accuracyCalm)} calm. When the clock or the position pushed, the mask came off — this is the gap to train.`;
}

export function coachReport(review: GameReview, mind: MindReport): CoachReport {
  const paragraphs: string[] = [];
  const w = mind.white;
  const b = mind.black;

  if (review.opening) {
    const sb = mind.keyMoments.find((k) => k.kind === 'script-break');
    paragraphs.push(
      `The game opened as the ${review.opening.name} (${review.opening.eco}).` +
        (sb ? ` ${sb.side === 'w' ? name('w', w) : name('b', b)} left the script first at ${sb.title} — that is where both players stopped reciting and started thinking.` : ''),
    );
  }
  for (const [side, p] of [['w', w], ['b', b]] as const) {
    if (p.accuracyOutOfBook !== undefined && review.lastBookPly >= 0) {
      const acc = side === 'w' ? review.white.accuracy : review.black.accuracy;
      if (acc - p.accuracyOutOfBook > 12)
        paragraphs.push(`${name(side, p)} played ${pct(acc)} overall but only ${pct(p.accuracyOutOfBook)} in the first moves after theory ran out. The opening was memorized, not understood — the script hid the player.`);
    }
  }
  const lead = w.initiativeShare >= b.initiativeShare ? (['w', w] as const) : (['b', b] as const);
  paragraphs.push(`${name(lead[0], lead[1])} held the frame for ${Math.round(100 * lead[1].initiativeShare)}% of the contested moments — making threats while the other side answered them.`);
  const biggest = [...review.plies].sort((a, c) => c.epLoss - a.epLoss)[0];
  if (biggest && biggest.epLoss >= 0.1) {
    const n = Math.ceil(biggest.ply / 2);
    paragraphs.push(`Turning point: ${n}${biggest.side === 'w' ? '.' : '...'} ${biggest.san}. ${mind.reads[biggest.ply - 1].why}`);
  }

  const forPlayer = Object.fromEntries(
    (['w', 'b'] as const).map((side) => {
      const p = side === 'w' ? w : b;
      const [a1, a2] = p.mask;
      const share = (a: Archetype) => Math.round(100 * p.archetypes[a]);
      return [
        side,
        {
          mask: `${ARCHETYPE_INFO[a1].title} (${share(a1)}%) + ${ARCHETYPE_INFO[a2].title} (${share(a2)}%). ${ARCHETYPE_INFO[a1].board}${p.confidence === 'low' ? ' (Low confidence: short game — read across several games.)' : ''}`,
          identity: identityLine(p),
          prescription: PRESCRIPTIONS[a1].drill,
          script: PRESCRIPTIONS[a1].script,
        },
      ];
    }),
  ) as CoachReport['forPlayer'];

  const winner = review.white.accuracy >= review.black.accuracy ? 'White' : 'Black';
  return {
    headline: `${winner} played the board better; ${lead[0] === 'w' ? 'White' : 'Black'} owned the frame.`,
    paragraphs,
    forPlayer,
  };
}
