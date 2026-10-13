import { COACHES, LESSONS, lessonsByTrack, type Lesson } from '@mindboard/core';
import { Chess } from 'chess.js';
import { arrow, Board } from '../board';
import { clear, h } from '../dom';
import type { View } from '../main';
import { pref, setPref } from '../store';

const done = () => new Set(pref<string[]>('lessonsDone', []));

export const lessonsView: View = (el) => {
  const finished = done();
  el.append(h('h1', 'Lessons'), h('p.muted', 'Learn the board, then learn the player. Each track ends where the script ends.'));
  for (const [track, lessons] of Object.entries(lessonsByTrack())) {
    el.append(
      h('h2', track === 'Mind' ? 'Mind track — the twist' : track),
      h(
        'div.grid',
        lessons.map((l) => {
          const coach = COACHES.find((c) => c.teaches.includes(l.id));
          return h(
            'div.card.link',
            { onclick: () => (location.hash = `#/lessons/${l.id}`) },
            h('h3', finished.has(l.id) ? `✓ ${l.title}` : l.title),
            h('span.pill', l.level),
            h('p.small.muted', l.summary),
            coach ? h('div.small', `Taught by ${coach.name}, ${coach.title}`) : null,
          );
        }),
      ),
    );
  }
};

export const lessonView: View = (el, [id]) => {
  const lesson = LESSONS.find((l) => l.id === id);
  if (!lesson) return void el.append(h('h1', 'Lesson not found'));
  runLesson(el, lesson);
};

function runLesson(el: HTMLElement, lesson: Lesson): void {
  let stepIdx = 0;
  let taskIdx = 0;
  const coach = COACHES.find((c) => c.teaches.includes(lesson.id));
  const text = h('div.card');
  const feedback = h('div.status');
  const nav = h('div.row');
  const boardEl = h('div.board');
  const board = new Board(boardEl, {
    onMove: (uci) => {
      const task = lesson.steps[stepIdx].tasks?.[taskIdx];
      if (!task) return;
      const ok = task.accept.some((a) => a === uci || (a.length === 5 && a.slice(0, 4) === uci.slice(0, 4)));
      if (!ok) {
        feedback.textContent = 'Not quite. Try again.';
        setTimeout(() => {
          board.load(fenBefore);
        }, 600);
        return;
      }
      taskIdx++;
      if (task.reply) {
        setTimeout(() => {
          board.apply(task.reply!);
          fenBefore = board.chess.fen();
          afterTask();
        }, 400);
      } else {
        fenBefore = board.chess.fen();
        afterTask();
      }
    },
  });
  let fenBefore = '';
  el.append(
    h('div.row', h('a', { href: '#/lessons' }, '← Lessons')),
    h('h1', lesson.title),
    h('p.muted', coach ? `${coach.name}, ${coach.title}: “${coach.philosophy}”` : lesson.summary),
    h('div.game', h('div', boardEl), h('div.side-panel', text, feedback, nav)),
  );

  const afterTask = () => {
    const step = lesson.steps[stepIdx];
    if (taskIdx >= (step.tasks?.length ?? 0)) {
      feedback.textContent = board.chess.isCheckmate() ? 'Checkmate. ✓' : 'Correct. ✓';
      board.setInteractive(undefined);
      showNav(true);
    } else {
      feedback.textContent = 'Good. Keep going.';
      board.setInteractive(board.chess.turn() === 'w' ? 'white' : 'black');
    }
  };

  const showNav = (canNext: boolean) => {
    const last = stepIdx === lesson.steps.length - 1;
    clear(
      nav,
      stepIdx > 0 ? h('button', { onclick: () => go(stepIdx - 1) }, 'Back') : null,
      lesson.steps[stepIdx].tasks && !canNext
        ? h('button', {
            onclick: () => {
              const t = lesson.steps[stepIdx].tasks![taskIdx];
              feedback.textContent = t.hint ?? 'Look for forcing moves: checks, captures, threats.';
              board.shapes([arrow(t.accept[0], 'blue')]);
            },
          }, 'Hint')
        : null,
      canNext
        ? h(
            'button.primary',
            {
              onclick: () => {
                if (last) {
                  setPref('lessonsDone', [...done(), lesson.id]);
                  location.hash = '#/lessons';
                } else go(stepIdx + 1);
              },
            },
            last ? 'Finish' : 'Next',
          )
        : null,
    );
  };

  const go = (i: number) => {
    stepIdx = i;
    taskIdx = 0;
    const step = lesson.steps[i];
    clear(text, h('div.muted.small', `Step ${i + 1} of ${lesson.steps.length}`), h('p', step.text));
    feedback.textContent = step.tasks ? `${new Chess(step.fen).turn() === 'w' ? 'White' : 'Black'} to move.` : '';
    board.load(step.fen ?? new Chess().fen());
    board.shapes([]);
    board.orientation(step.orientation ?? (step.fen && new Chess(step.fen).turn() === 'b' && step.tasks ? 'black' : 'white'));
    fenBefore = board.chess.fen();
    board.setInteractive(step.tasks ? (board.chess.turn() === 'w' ? 'white' : 'black') : undefined);
    boardEl.style.opacity = step.fen ? '1' : '0.35';
    showNav(!step.tasks);
  };
  go(0);
}
