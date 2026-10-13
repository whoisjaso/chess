/**
 * Glicko-2 (Glickman, 2012). Lichess uses Glicko-2; Chess.com uses Glicko-1. Both track a rating
 * deviation (how sure we are) so new players move fast and established players move slowly.
 */
export interface Rating {
  rating: number;
  rd: number;
  vol: number;
}

export const DEFAULT_RATING: Rating = { rating: 1500, rd: 350, vol: 0.06 };
const SCALE = 173.7178;
const TAU = 0.5;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muj: number, phij: number) => 1 / (1 + Math.exp(-g(phij) * (mu - muj)));

/** Update `player` after a rating period of games against `opponents` with `scores` (1, 0.5, 0). */
export function glicko2(player: Rating, opponents: Rating[], scores: number[]): Rating {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  if (!opponents.length) {
    const phiStar = Math.sqrt(phi * phi + player.vol * player.vol);
    return { ...player, rd: Math.min(350, phiStar * SCALE) };
  }
  const ops = opponents.map((o) => ({ mu: (o.rating - 1500) / SCALE, phi: o.rd / SCALE }));
  let vInv = 0;
  let deltaSum = 0;
  ops.forEach((o, i) => {
    const e = E(mu, o.mu, o.phi);
    vInv += g(o.phi) ** 2 * e * (1 - e);
    deltaSum += g(o.phi) * (scores[i] - e);
  });
  const v = 1 / vInv;
  const delta = v * deltaSum;

  // Volatility update (Illinois algorithm).
  const a = Math.log(player.vol ** 2);
  const f = (x: number) =>
    (Math.exp(x) * (delta ** 2 - phi ** 2 - v - Math.exp(x))) / (2 * (phi ** 2 + v + Math.exp(x)) ** 2) - (x - a) / TAU ** 2;
  let A = a;
  let B: number;
  if (delta ** 2 > phi ** 2 + v) B = Math.log(delta ** 2 - phi ** 2 - v);
  else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > 1e-6) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA /= 2;
    B = C;
    fB = fC;
  }
  const vol = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi ** 2 + vol ** 2);
  const phiNew = 1 / Math.sqrt(1 / phiStar ** 2 + 1 / v);
  const muNew = mu + phiNew ** 2 * deltaSum;
  return { rating: muNew * SCALE + 1500, rd: Math.max(30, phiNew * SCALE), vol };
}

/** Rate a single game between two players. */
export function rateGame(white: Rating, black: Rating, whiteScore: number): { white: Rating; black: Rating } {
  return { white: glicko2(white, [black], [whiteScore]), black: glicko2(black, [white], [1 - whiteScore]) };
}
