import { Chess, type PieceSymbol } from 'chess.js';

/**
 * Voice Mode: turn a spoken phrase ("knight to f3", "bishop takes c6", "castle kingside", "e4")
 * into a legal UCI move. Speech recognisers mishear chess words, so we normalise homophones first.
 */
const PIECE_WORDS: Record<string, PieceSymbol> = {
  knight: 'n', night: 'n', nite: 'n', horse: 'n', nights: 'n', knights: 'n',
  bishop: 'b', bishops: 'b',
  rook: 'r', rock: 'r', brook: 'r', rooks: 'r', look: 'r',
  queen: 'q', queens: 'q', clean: 'q',
  king: 'k', kings: 'k',
  pawn: 'p', pawns: 'p', porn: 'p', pond: 'p', paun: 'p', on: 'p',
};

const FILE_WORDS: Record<string, string> = {
  a: 'a', ay: 'a', hey: 'a', alpha: 'a',
  b: 'b', be: 'b', bee: 'b', bravo: 'b',
  c: 'c', see: 'c', sea: 'c', cee: 'c', charlie: 'c',
  d: 'd', dee: 'd', delta: 'd',
  e: 'e', ee: 'e', echo: 'e',
  f: 'f', ef: 'f', eff: 'f', foxtrot: 'f',
  g: 'g', gee: 'g', golf: 'g', jee: 'g',
  h: 'h', age: 'h', aitch: 'h', hotel: 'h', each: 'h',
};

const RANK_WORDS: Record<string, string> = {
  one: '1', won: '1', '1': '1',
  two: '2', to: '2', too: '2', '2': '2',
  three: '3', tree: '3', '3': '3',
  four: '4', for: '4', fore: '4', '4': '4',
  five: '5', '5': '5',
  six: '6', sex: '6', '6': '6',
  seven: '7', '7': '7',
  eight: '8', ate: '8', '8': '8',
};

const CAPTURE = new Set(['takes', 'take', 'captures', 'capture', 'x', 'by', 'times']);
const PROMO = new Set(['promote', 'promotes', 'promotion', 'equals']);

type Tok = { kind: 'piece'; p: PieceSymbol } | { kind: 'file'; f: string } | { kind: 'rank'; r: string } | { kind: 'square'; s: string } | { kind: 'capture' } | { kind: 'promo' } | { kind: 'castle'; long: boolean };

function tokenize(raw: string): Tok[] {
  const text = raw
    .toLowerCase()
    .replace(/o-o-o|0-0-0/g, ' longcastle ')
    .replace(/o-o|0-0/g, ' shortcastle ')
    .replace(/[^a-z0-9 ]/g, ' ')
    // "e4", "f3" spoken as one word
    .replace(/\b([a-h])([1-8])\b/g, ' $1 $2 ');
  const words = text.split(/\s+/).filter(Boolean);
  const out: Tok[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === 'longcastle' || ((w === 'castle' || w === 'castles') && /queen|long/.test(words.slice(i + 1, i + 3).join(' '))) || (w === 'long' && words[i + 1]?.startsWith('castle'))) {
      out.push({ kind: 'castle', long: true });
      break;
    }
    if (w === 'shortcastle' || w === 'castle' || w === 'castles' || (w === 'short' && words[i + 1]?.startsWith('castle'))) {
      out.push({ kind: 'castle', long: false });
      break;
    }
    if (CAPTURE.has(w)) out.push({ kind: 'capture' });
    else if (PROMO.has(w)) out.push({ kind: 'promo' });
    else if (w in PIECE_WORDS) {
      if (w === 'on' && out.length > 0) continue; // "knight on f3": filler word, not a pawn
      out.push({ kind: 'piece', p: PIECE_WORDS[w] });
    } else if (w in FILE_WORDS && (words[i + 1] ? words[i + 1] in RANK_WORDS : false)) {
      out.push({ kind: 'square', s: FILE_WORDS[w] + RANK_WORDS[words[i + 1]] });
      i++;
    } else if (w in FILE_WORDS && w.length === 1) out.push({ kind: 'file', f: FILE_WORDS[w] });
    else if (w in RANK_WORDS && !['to', 'too', 'for'].includes(w)) out.push({ kind: 'rank', r: RANK_WORDS[w] });
  }
  return out;
}

/** Parse a spoken move. Returns UCI if exactly one legal move fits, otherwise null. */
export function parseSpokenMove(text: string, fen: string): string | null {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  const toks = tokenize(text);
  const castle = toks.find((t) => t.kind === 'castle') as Extract<Tok, { kind: 'castle' }> | undefined;
  if (castle) {
    const m = legal.find((x) => (castle.long ? x.isQueensideCastle() : x.isKingsideCastle()));
    return m ? m.from + m.to : null;
  }
  const pieces = toks.filter((t): t is Extract<Tok, { kind: 'piece' }> => t.kind === 'piece');
  const squares = toks.filter((t): t is Extract<Tok, { kind: 'square' }> => t.kind === 'square').map((t) => t.s);
  const capture = toks.some((t) => t.kind === 'capture');
  const promoIdx = toks.findIndex((t) => t.kind === 'promo');
  const promo = promoIdx >= 0 ? (toks.slice(promoIdx).find((t) => t.kind === 'piece') as Extract<Tok, { kind: 'piece' }> | undefined)?.p : undefined;
  const fromFile = toks.find((t) => t.kind === 'file') as Extract<Tok, { kind: 'file' }> | undefined;
  const mover = pieces.find((_, i) => promoIdx < 0 || toks.indexOf(pieces[i]) < promoIdx)?.p;
  if (!squares.length) return null;
  const to = squares[squares.length - 1];
  const from = squares.length > 1 ? squares[0] : undefined;
  let cands = legal.filter((m) => m.to === to);
  if (from) cands = cands.filter((m) => m.from === from);
  if (mover) cands = cands.filter((m) => m.piece === mover);
  if (capture && cands.some((m) => m.captured)) cands = cands.filter((m) => !!m.captured);
  if (fromFile && !from) {
    const f = cands.filter((m) => m.from[0] === fromFile.f);
    if (f.length) cands = f;
  }
  if (!mover && !from && cands.length > 1) {
    // "e4" with no piece named means a pawn, as in algebraic notation.
    const pawns = cands.filter((m) => m.piece === 'p');
    if (pawns.length) cands = pawns;
  }
  const promoted = cands.filter((m) => m.promotion);
  if (promoted.length) cands = promoted.filter((m) => m.promotion === (promo ?? 'q'));
  const uniq = [...new Map(cands.map((m) => [m.from + m.to + (m.promotion ?? ''), m])).values()];
  return uniq.length === 1 ? uniq[0].from + uniq[0].to + (uniq[0].promotion ?? '') : null;
}

const NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/** Say a SAN move out loud: "Nxe5+" -> "Knight takes e5, check". */
export function speakMove(san: string): string {
  if (san.startsWith('O-O-O')) return 'Castles queenside' + (san.includes('#') ? ', checkmate' : san.includes('+') ? ', check' : '');
  if (san.startsWith('O-O')) return 'Castles kingside' + (san.includes('#') ? ', checkmate' : san.includes('+') ? ', check' : '');
  const m = san.match(/^([NBRQK])?([a-h])?([1-8])?(x)?([a-h][1-8])(=([NBRQ]))?([+#])?$/);
  if (!m) return san;
  const piece = m[1] ? NAMES[m[1].toLowerCase()] : m[4] ? `${m[2]} pawn` : '';
  const parts = [piece, m[4] ? 'takes' : '', m[5].toUpperCase().split('').join(' ')];
  let s = parts.filter(Boolean).join(' ').replace(/^\s+/, '');
  if (m[7]) s += `, promotes to ${NAMES[m[7].toLowerCase()]}`;
  if (m[8] === '#') s += ', checkmate';
  else if (m[8] === '+') s += ', check';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
