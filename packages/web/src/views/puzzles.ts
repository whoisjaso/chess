import { checkPuzzleMove, DEFAULT_RATING, glicko2, PUZZLES, type Puzzle, type Rating } from '@chessbutfree/core';
import { Chess } from 'chess.js';
import { arrow, Board } from '../board';
import { avatar, boardLayout, bubble, img3d, panelHead } from '../components';
import { clear, h } from '../dom';
import { icon } from '../icons';
import type { View } from '../main';
import { play } from '../sound';
import { pref, setPref } from '../store';
import { speak } from '../voice';
import { mistakePuzzles } from './review';

/** Puzzles: Chess.com's loop. Find the move, get rated, next. Plus puzzles mined from your own mistakes. */
export const puzzlesView: View = (el) => {
  const L = boardLayout();
  el.append(L.root);
  let mode: 'rated' | 'mine' = 'rated';
  let rating: Rating = pref('puzzleRating', { ...DEFAULT_RATING, rating: 800 });
  const solved = new Set(pref<string[]>('puzzlesSolved', []));
  let puzzle: Puzzle;
  let step = 0;
  let state: 'solving' | 'correct' | 'wrong' = 'solving';
  let mistakes = 0;
  let posFen = '';
  const coach = pref('coach', 'kiyo');

  const board = new Board(L.boardHost, {
    onMove: (uci) => {
      const expected = puzzle.solution[step];
      const isLast = step === puzzle.solution.length - 1;
      if (!checkPuzzleMove(posFen, expected, uci, isLast)) {
        mistakes++;
        state = 'wrong';
        play('wrong');
        board.setInteractive(undefined);
        settle(0);
        render();
        speak(coach, 'Not that one. Look again.');
        return;
      }
      step++;
      if (step >= puzzle.solution.length || isLast) {
        state = 'correct';
        play('correct');
        board.setInteractive(undefined);
        solved.add(puzzle.id);
        setPref('puzzlesSolved', [...solved]);
        if (mistakes === 0) settle(1);
        render();
        speak(coach, mistakes ? 'Solved.' : 'Correct!');
        return;
      }
      setTimeout(() => {
        board.apply(puzzle.solution[step]);
        posFen = board.chess.fen();
        step++;
        render();
      }, 350);
    },
  });

  let settledFor = '';
  const settle = (score: number) => {
    if (mode !== 'rated' || settledFor === puzzle.id) return;
    settledFor = puzzle.id;
    const before = Math.round(rating.rating);
    rating = glicko2(rating, [{ rating: puzzle.rating, rd: 80, vol: 0.06 }], [score]);
    setPref('puzzleRating', rating);
    delta = Math.round(rating.rating) - before;
  };
  let delta = 0;

  const pool = () => (mode === 'rated' ? PUZZLES : mistakePuzzles());

  const next = () => {
    const list = pool();
    if (!list.length) {
      render();
      return;
    }
    const unsolved = list.filter((p) => !solved.has(p.id));
    const candidates = (unsolved.length ? unsolved : list).sort((a, b) => Math.abs(a.rating - rating.rating) - Math.abs(b.rating - rating.rating));
    puzzle = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
    step = 0;
    mistakes = 0;
    delta = 0;
    state = 'solving';
    board.load(puzzle.fen);
    posFen = puzzle.fen;
    board.shapes([]);
    const side = new Chess(puzzle.fen).turn() === 'w' ? 'white' : 'black';
    board.orientation(side);
    board.setInteractive(side);
    L.bottom.set({ name: 'You', rating: Math.round(rating.rating), avatar: avatar() });
    L.top.set({ name: mode === 'rated' ? `Puzzle ${puzzle.id.toUpperCase()}` : 'Your mistake', rating: mode === 'rated' ? puzzle.rating : undefined, avatar: avatar(coach) });
    render();
  };

  const render = () => {
    const list = pool();
    const toMove = puzzle ? (new Chess(puzzle.fen).turn() === 'w' ? 'White' : 'Black') : '';
    const status =
      !list.length
        ? bubble(avatar(coach), h('div.head', 'No mistakes yet'), 'Review a game you played. Every mistake becomes a puzzle here, so you can fix it for good.')
        : state === 'solving'
          ? bubble(avatar(coach), h('div.head', `${toMove} to move`), puzzle.title ?? 'Find the best move.', h('div', { style: 'margin-top:6px;font-size:13px;color:#5d5a57' }, puzzle.themes.join(' · ')))
          : state === 'correct'
            ? h('div.banner.ok', icon('check'), mistakes ? 'Solved (with a retry)' : 'Correct!', delta ? h('span', { style: 'margin-left:auto' }, `${delta > 0 ? '+' : ''}${delta}`) : null)
            : h('div.banner.bad', icon('x'), 'Incorrect', delta ? h('span', { style: 'margin-left:auto' }, `${delta}`) : null);
    clear(
      L.panel,
      panelHead('Puzzles', img3d('puzzles')),
      h(
        'div.panel-body',
        h(
          'div.row',
          { style: 'display:flex;gap:8px' },
          h('button.btn.sm', { style: `flex:1;${mode === 'rated' ? 'outline:2px solid var(--green)' : ''}`, onclick: () => ((mode = 'rated'), next()) }, 'Rated'),
          h('button.btn.sm', { style: `flex:1;${mode === 'mine' ? 'outline:2px solid var(--green)' : ''}`, onclick: () => ((mode = 'mine'), next()) }, `Your Mistakes (${mistakePuzzles().length})`),
        ),
        h('div.bot-hero', h('div.dim', { style: 'font-weight:800' }, 'PUZZLE RATING'), h('div', { style: 'font-size:40px;font-weight:900' }, String(Math.round(rating.rating))), h('div.dim', `${solved.size} solved`)),
        status,
      ),
      h(
        'div.panel-foot',
        state === 'wrong'
          ? h(
              'div.row',
              h('button.btn', { onclick: () => ((state = 'solving'), (step = 0), (posFen = puzzle.fen), board.load(puzzle.fen), board.setInteractive(new Chess(puzzle.fen).turn() === 'w' ? 'white' : 'black'), render()) }, icon('retry'), 'Retry'),
              h('button.btn', { onclick: () => board.shapes([arrow(puzzle.solution[step], 'green')]) }, icon('bulb'), 'Solution'),
            )
          : state === 'solving' && list.length
            ? h('button.btn', { onclick: () => board.shapes([arrow(puzzle.solution[step], 'blue')]) }, icon('bulb'), 'Hint')
            : null,
        h('button.btn.green.xl', { onclick: next }, state === 'solving' ? 'Skip' : 'Next Puzzle'),
      ),
    );
  };

  next();
};
