import raw from './data/openings.json';

export interface Opening {
  eco: string;
  name: string;
  /** Space-separated UCI moves of the named line. */
  uci: string;
  epd: string;
}

const rows = raw as [string, string, string, string][];

/** The full named-opening table (CC0, lichess-org/chess-openings). */
export const OPENINGS: Opening[] = rows.map(([eco, name, uci, epd]) => ({ eco, name, uci, epd }));

const byEpd = new Map<string, Opening>();
for (const o of OPENINGS) if (!byEpd.has(o.epd)) byEpd.set(o.epd, o);

export function epd(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function openingAt(fen: string): Opening | undefined {
  return byEpd.get(epd(fen));
}

/** Name of the deepest named position reached in a sequence of FENs. */
export function identifyOpening(fens: string[]): { opening?: Opening; lastBookIndex: number } {
  let opening: Opening | undefined;
  let lastBookIndex = -1;
  fens.forEach((f, i) => {
    const o = openingAt(f);
    if (o) {
      opening = o;
      lastBookIndex = i;
    }
  });
  return { opening, lastBookIndex };
}

export function searchOpenings(query: string, limit = 50): Opening[] {
  const q = query.trim().toLowerCase();
  if (!q) return OPENINGS.filter((o) => !o.name.includes(':')).slice(0, limit);
  return OPENINGS.filter((o) => o.name.toLowerCase().includes(q) || o.eco.toLowerCase() === q).slice(0, limit);
}

/** Named continuations from a position: the "book" a player can still hide inside. */
export function bookContinuations(fen: string): { uci: string; opening: Opening; lines: number }[] {
  const key = epd(fen);
  const start = OPENINGS.find((o) => o.epd === key);
  const prefix = start ? start.uci : null;
  if (prefix === null && key !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -') return [];
  const depth = prefix ? prefix.split(' ').length : 0;
  const seen = new Map<string, Opening>();
  const weight = new Map<string, number>();
  for (const o of OPENINGS) {
    const moves = o.uci.split(' ');
    if (moves.length <= depth) continue;
    if (prefix && !o.uci.startsWith(prefix + ' ')) continue;
    const next = moves[depth];
    weight.set(next, (weight.get(next) ?? 0) + 1);
    const cur = seen.get(next);
    if (!cur || o.uci.split(' ').length < cur.uci.split(' ').length) seen.set(next, o);
  }
  // Main lines first: the more named theory behind a move, the more it is played.
  return [...seen.entries()].map(([uci, opening]) => ({ uci, opening, lines: weight.get(uci) ?? 0 })).sort((a, b) => b.lines - a.lines);
}
