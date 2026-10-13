import { bookContinuations, openingAt, pliesFromUci, searchOpenings } from '@chessbutfree/core';
import { Chess } from 'chess.js';
import { Board } from '../board';
import { avatar, boardLayout, img3d, moveTable, navButtons, panelHead } from '../components';
import { clear, h } from '../dom';
import { icon } from '../icons';
import type { View } from '../main';

/** Opening Explorer: named theory, its continuations, and where the script ends. */
export const openingsView: View = (el, _p, query) => {
  const L = boardLayout();
  el.append(L.root);
  const moves: string[] = [];
  let view = 0;
  let q = query.get('q') ?? '';
  let tab: 'explore' | 'search' = q ? 'search' : 'explore';
  const board = new Board(L.boardHost, {
    interactive: 'both',
    onMove: (uci) => {
      moves.splice(view, moves.length, uci);
      view = moves.length;
      render();
    },
  });
  L.top.set({ name: 'Black', avatar: avatar() });
  L.bottom.set({ name: 'White', avatar: avatar() });

  const playLine = (line: string[], at = line.length) => {
    moves.splice(0, moves.length, ...line);
    show(at);
  };
  const show = (n: number) => {
    view = Math.max(0, Math.min(moves.length, n));
    const c = new Chess();
    for (const u of moves.slice(0, view)) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
    board.load(c.fen(), moves[view - 1]);
    render();
  };

  const render = () => {
    const fen = board.chess.fen();
    let named = openingAt(fen);
    // Name the deepest named position on the path, even if this exact one is unnamed.
    if (!named) for (const p of pliesFromUci(moves.slice(0, view)).reverse()) if ((named = openingAt(p.fenAfter))) break;
    const inBook = !!openingAt(fen) || view === 0;
    const cont = bookContinuations(fen);
    const tabsEl = h(
      'div.panel-tabs',
      h('button', { class: tab === 'explore' ? 'on' : '', onclick: () => ((tab = 'explore'), render()) }, icon('board'), 'Explore'),
      h('button', { class: tab === 'search' ? 'on' : '', onclick: () => ((tab = 'search'), render()) }, icon('search'), 'Search'),
    );
    const body =
      tab === 'explore'
        ? [
            h('div.card', { style: 'background:#2f2d2a;padding:12px' }, h('div.dim', { style: 'font-weight:800;font-size:12px' }, named ? named.eco : 'START'), h('div', { style: 'font-weight:900;font-size:18px' }, named ? named.name : 'Starting Position')),
            !inBook ? h('div.banner.info', icon('bulb'), 'Out of book — the script has ended. From here, players have to think.') : null,
            cont.length ? h('div.report', h('div.section', 'Book moves')) : null,
            cont.slice(0, 30).map(({ uci, opening }) => {
              const san = pliesFromUci([uci], fen)[0].san;
              return h('div.tile.plain', { style: 'font-size:14px;padding:9px 12px', onclick: () => playLine([...moves.slice(0, view), uci]) }, h('b', { style: 'width:56px' }, san), h('span.t', { style: 'font-size:13.5px;font-weight:600' }, opening.name));
            }),
            moveTable(pliesFromUci(moves).map((p) => p.san), view, show),
          ]
        : [
            h('input.input', { value: q, placeholder: 'Sicilian, Ruy Lopez, C50…', oninput: (e: Event) => ((q = (e.target as HTMLInputElement).value), renderList()) }),
            listBox,
          ];
    clear(L.panel, panelHead('Explorer', img3d('openings')), tabsEl, h('div.panel-body', body), h('div.panel-foot', navButtons((w) => show(w === 'first' ? 0 : w === 'prev' ? view - 1 : w === 'next' ? view + 1 : moves.length), h('button.btn.sm', { onclick: () => board.flip() }, icon('flip')))));
    if (tab === 'search') renderList();
  };
  const listBox = h('div', { style: 'display:flex;flex-direction:column;gap:8px' });
  const renderList = () =>
    clear(
      listBox,
      searchOpenings(q, 80).map((o) =>
        h('div.tile.plain', { style: 'font-size:14px;padding:9px 12px', onclick: () => ((tab = 'explore'), playLine(o.uci.split(' '))) }, h('span.pill', o.eco), h('span.t', { style: 'font-size:14px' }, o.name, h('small', `${o.uci.split(' ').length} moves`))),
      ),
    );
  render();
};
