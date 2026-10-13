import { describe, expect, it } from 'vitest';
import { parseSpokenMove, speakMove } from '../src';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const ITALIAN = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

describe('Voice Mode: spoken moves', () => {
  it.each([
    ['e4', START, 'e2e4'],
    ['pawn to e four', START, 'e2e4'],
    ['knight to f3', START, 'g1f3'],
    ['Night F3', START, 'g1f3'],
    ['knight c three', START, 'b1c3'],
    ['castle kingside', ITALIAN, 'e1g1'],
    ['short castle', ITALIAN, 'e1g1'],
    ['O-O', ITALIAN, 'e1g1'],
    ['bishop takes f7', ITALIAN, 'c4f7'],
    ['bishop x f seven', ITALIAN, 'c4f7'],
    ['knight takes e5', ITALIAN, 'f3e5'],
    ['d4', ITALIAN, 'd2d4'],
  ])('"%s"', (said, fen, uci) => {
    expect(parseSpokenMove(said, fen)).toBe(uci);
  });
  it('rejects ambiguous or illegal phrases', () => {
    expect(parseSpokenMove('knight', START)).toBeNull();
    expect(parseSpokenMove('queen to h5', START)).toBeNull();
  });
  it('promotes to a queen by default', () => {
    expect(parseSpokenMove('a8', '8/P6k/8/8/8/8/8/K7 w - - 0 1')).toBe('a7a8q');
    expect(parseSpokenMove('a8 promote knight', '8/P6k/8/8/8/8/8/K7 w - - 0 1')).toBe('a7a8n');
  });
  it('speaks SAN', () => {
    expect(speakMove('Nxe5+')).toBe('Knight takes E 5, check');
    expect(speakMove('O-O')).toBe('Castles kingside');
    expect(speakMove('exd5')).toBe('E pawn takes D 5');
    expect(speakMove('Qxf7#')).toBe('Queen takes F 7, checkmate');
  });
});
