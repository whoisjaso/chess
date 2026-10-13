import { BOTS, COACHES } from '@chessbutfree/core';
import { Board } from '../board';
import { avatar, bubble, img3d } from '../components';
import { h } from '../dom';
import { tierIcon } from '../icons';
import type { View } from '../main';
import { listGames } from '../store';

// The Opera Game, just before 16.Qb8+!!
const HERO_FEN = '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 16';

export const homeView: View = (el) => {
  const boardHost = h('div.mini-board');
  const games = listGames().length;
  el.append(
    h(
      'div.home',
      h(
        'section.hero',
        boardHost,
        h(
          'div',
          h('h1', 'Play Chess Online — Free, Forever.'),
          h('p.lead', 'Everything a chess site gives you, open source and free. Plus a read on the mind behind every move.'),
          h(
            'div.stack',
            h('a.btn.green.xl', { href: '#/play' }, h('img', { src: img3d('play'), alt: '' }), h('span.lbl', 'Play Online', h('span.sub', 'Play with someone at your level'))),
            h('a.btn.xl', { href: '#/play/bots' }, h('img', { src: img3d('bots'), alt: '' }), h('span.lbl', 'Play Bots', h('span.sub', 'Six bots, six masks — learn to read them'))),
          ),
          h('div.stats', games ? `${games} games on this device · no account needed` : 'No account needed · nothing to pay · ever'),
        ),
      ),
      feature(
        'Solve Chess Puzzles',
        'Train tactics with puzzles that are proven correct — then turn your own blunders into puzzles automatically.',
        ['Solve Puzzles', '#/puzzles'],
        h('img', { src: img3d('puzzles'), alt: '', style: 'width:220px' }),
      ),
      feature(
        'Game Review, with a Mind Read',
        'Brilliant to blunder, accuracy, best lines — and the part no one else shows you: why you played it, who held the frame, and the mask behind your choices.',
        ['Review a Game', '#/review'],
        h(
          'div',
          { style: 'max-width:420px;display:flex;flex-direction:column;gap:10px' },
          bubble(avatar('kiyo'), h('div.head', tierIcon('brilliant'), 'Qb8+ is brilliant'), 'You gave up the queen to own the position. Most people cannot let go of what they hold.'),
          bubble(avatar('tenka'), h('div.head', tierIcon('mistake'), 'Frame lost'), 'Three answers in a row. You are no longer playing; you are being played.'),
        ),
      ),
      feature(
        'Play the Masked Bots',
        'The Showman sacrifices for the crowd. The Diplomat trades into safety. The Bookworm collapses out of theory. Every bot wears one of six psychological masks.',
        ['Play Bots', '#/play/bots'],
        h('div.ava-row', BOTS.map((b) => h('img', { src: avatar(b.id), alt: b.name, title: b.name }))),
      ),
      feature(
        'Learn from the Coaches',
        'Seven teachers modelled on fiction’s sharpest minds. Lessons from tactics to the Mind track: frame, tilt, time pressure, and reading your opponent.',
        ['Start Learning', '#/lessons'],
        h('div.ava-row', COACHES.map((c) => h('img', { src: avatar(c.id), alt: c.name, title: `${c.name} — ${c.title}`, style: 'width:80px;height:80px' }))),
      ),
    ),
  );
  const board = new Board(boardHost, { fen: HERO_FEN, viewOnly: true, sound: false });
  board.cg.set({ lastMove: ['f6', 'd7'] });
  setTimeout(() => board.badge('d7', 'great'), 50);
};

function feature(title: string, body: string, [cta, href]: [string, string], art: Node): HTMLElement {
  return h('section.feature', h('div', h('h2', title), h('p', body), h('a.btn.green.lg', { href, style: 'width:auto' }, cta)), h('div.art', art));
}
