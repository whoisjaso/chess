import { bookContinuations, openingAt, searchOpenings, type Opening } from '@mindboard/core';
import { Chess } from 'chess.js';
import { Board } from '../board';
import { clear, h } from '../dom';
import type { View } from '../main';

export const openingsView: View = (el, _p, query) => {
  const boardEl = h('div.board');
  const title = h('h2', 'Starting position');
  const next = h('div');
  const path = h('div.small.muted');
  const results = h('div');
  const moves: string[] = [];
  const board = new Board(boardEl, { interactive: 'both', onMove: (uci) => (moves.push(uci), refresh()) });

  const play = (uciLine: string[]) => {
    moves.splice(0, moves.length, ...uciLine);
    const c = new Chess();
    for (const u of uciLine) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
    board.load(c.fen(), uciLine[uciLine.length - 1]);
    refresh();
  };

  const refresh = () => {
    const fen = board.chess.fen();
    const named = openingAt(fen);
    title.textContent = named ? `${named.eco} · ${named.name}` : moves.length ? 'Out of book — no named line here' : 'Starting position';
    path.textContent = board.chess.history().join(' ');
    const cont = bookContinuations(fen);
    clear(
      next,
      cont.length
        ? h('div.card', h('h3', 'Book continues with'), cont.slice(0, 20).map(({ uci, opening }) => h('div', h('a', { href: 'javascript:void 0', onclick: () => play([...moves, uci]) }, uci), h('span.muted.small', ` → ${opening.name}`))))
        : h('div.card', h('h3', 'The script has ended.'), h('p.small.muted', 'From here, nobody is reciting. This is where the Mind Engine starts reading.')),
    );
  };

  const search = h('input', { placeholder: 'Search openings (e.g. Sicilian, C50)', value: query.get('q') ?? '', oninput: () => list() });
  const list = () => clear(results, h('div.grid', searchOpenings(search.value, 60).map((o: Opening) => h('div.card.link', { onclick: () => play(o.uci.split(' ')) }, h('h3', o.name), h('span.pill', o.eco), h('div.small.muted', `${o.uci.split(' ').length} plies`)))));

  el.append(
    h('h1', 'Opening explorer'),
    h('p.muted', '3,800+ named lines (lichess chess-openings, CC0). Openings are scripts: learn them, and learn exactly where they end.'),
    h('div.game', h('div', boardEl), h('div.side-panel', title, path, h('div.row', h('button', { onclick: () => play(moves.slice(0, -1)) }, '◀ Back'), h('button', { onclick: () => play([]) }, 'Reset')), next)),
    h('h2', 'Browse'),
    search,
    h('div', { style: 'height:12px' }),
    results,
  );
  list();
  refresh();
};
