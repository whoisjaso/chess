import { COACHES, LESSONS, type Lesson, type Track } from '@chessbutfree/core';
import { Chess } from 'chess.js';
import { arrow, Board } from '../board';
import { avatar, boardLayout, bubble, img3d, panelHead } from '../components';
import { clear, h } from '../dom';
import { icon } from '../icons';
import type { View } from '../main';
import { play } from '../sound';
import { pref, setPref } from '../store';
import { onSpeaking, speak, stopSpeaking } from '../voice';

const done = () => new Set(pref<string[]>('lessonsDone', []));

const TRACKS: { id: Track; label: string; img: string; color: string }[] = [
  { id: 'Foundations', label: 'Foundations', img: 'play', color: '#5d8a3a' },
  { id: 'Tactics', label: 'Tactics', img: 'puzzles', color: '#a6542b' },
  { id: 'Checkmates', label: 'Checkmates', img: 'bots', color: '#7a2c2c' },
  { id: 'Openings', label: 'Openings', img: 'openings', color: '#7a5233' },
  { id: 'Endgames', label: 'Endgames', img: 'learn', color: '#2c5f8a' },
  { id: 'Mind', label: 'Mind', img: 'mind', color: '#156a63' },
];

/** Tiny static board (no interaction) for course thumbnails. */
function thumb(fen: string): HTMLElement {
  const host = h('div', { style: 'width:100%;height:100%' });
  queueMicrotask(() => new Board(host, { fen, viewOnly: true, sound: false }).cg.set({ coordinates: false }));
  return host;
}

export const lessonsView: View = (el, _p, query) => {
  let track: Track | 'all' = (query.get('track') as Track) ?? 'all';
  let q = '';
  const list = h('div');
  const finished = done();
  const render = () => {
    const items = LESSONS.filter((l) => (track === 'all' || l.track === track) && (!q || `${l.title} ${l.summary}`.toLowerCase().includes(q)));
    clear(
      list,
      items.map((l) => {
        const t = TRACKS.find((x) => x.id === l.track)!;
        const coach = COACHES.find((c) => c.teaches.includes(l.id));
        const fen = l.steps.find((s) => s.fen)?.fen ?? new Chess().fen();
        return h(
          'div.course',
          { onclick: () => (location.hash = `#/lessons/${l.id}`) },
          h('div.thumb', { style: `background:linear-gradient(135deg, ${t.color}, #1f1e1c)` }, h('div.label', l.title), h('div.mini', thumb(fen))),
          h(
            'div',
            h('h3', l.title),
            h('div.muted', l.summary),
            coach ? h('div.by', h('img', { src: avatar(coach.id), alt: '' }), h('span.badge', 'COACH'), `${coach.name}, ${coach.title}`) : null,
            h('div.meta', h('span', `${l.steps.length} steps`), h('span', l.level), h('span', l.track), finished.has(l.id) ? h('span.done', '✓ Completed') : null),
          ),
        );
      }),
      items.length ? null : h('div.dim', 'No lessons match.'),
    );
  };
  const total = LESSONS.length;
  const rank = ['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King'][Math.min(5, Math.floor((finished.size / total) * 6))];
  el.append(
    h(
      'div.page',
      h('div.page-head', h('img', { src: img3d('learn'), alt: '' }), h('h1', 'Lessons')),
      h(
        'div.track-tiles',
        TRACKS.map((t) =>
          h('button', { class: track === t.id ? 'on' : '', onclick: (e: Event) => ((track = track === t.id ? 'all' : t.id), (e.currentTarget as HTMLElement).parentElement!.querySelectorAll('button').forEach((b) => b.classList.remove('on')), track !== 'all' && (e.currentTarget as HTMLElement).classList.add('on'), render()) }, h('img', { src: img3d(t.img), alt: '' }), t.label),
        ),
      ),
      h(
        'div.two-col',
        h('div', h('input.input', { placeholder: 'Search lessons…', style: 'margin-bottom:14px', oninput: (e: Event) => ((q = (e.target as HTMLInputElement).value.toLowerCase()), render()) }), list),
        h(
          'div',
          { style: 'display:flex;flex-direction:column;gap:14px' },
          h(
            'div.card',
            { style: 'text-align:center' },
            h('h3', 'Learning Rank'),
            h('img', { src: img3d('learn'), alt: '', style: 'width:110px;margin:10px auto' }),
            h('div', { style: 'font-size:22px;font-weight:900' }, rank),
            h('div.dim', `${finished.size} / ${total} lessons`),
            h('div.progress', { style: 'margin-top:10px' }, h('div', { style: `width:${(100 * finished.size) / total}%` })),
          ),
          h('div.card', h('h3', 'The Mind track'), h('p.muted', { style: 'margin:0 0 12px;font-size:14px' }, 'Frame, scripts, tilt, time pressure and reading masks — what no other chess site teaches.'), h('a.btn.green.sm', { href: '#/lessons/mind-frame' }, 'Start')),
        ),
      ),
    ),
  );
  render();
};

export const lessonView: View = (el, [id]) => {
  const lesson = LESSONS.find((l) => l.id === id);
  if (!lesson) return void el.append(h('div.page', h('h1', 'Lesson not found')));
  run(el, lesson);
};

function run(el: HTMLElement, lesson: Lesson): void {
  const L = boardLayout();
  el.append(L.root);
  const coach = COACHES.find((c) => c.teaches.includes(lesson.id)) ?? COACHES[4];
  let stepIdx = 0;
  let taskIdx = 0;
  let fenBefore = '';
  let feedback: { kind: 'ok' | 'bad' | 'info'; text: string } | null = null;
  const board = new Board(L.boardHost, {
    onMove: (uci) => {
      const task = lesson.steps[stepIdx].tasks?.[taskIdx];
      if (!task) return;
      const ok = task.accept.some((a) => a.slice(0, 4) === uci.slice(0, 4));
      if (!ok) {
        feedback = { kind: 'bad', text: 'Not quite. Try again.' };
        play('wrong');
        render();
        setTimeout(() => board.load(fenBefore), 500);
        return;
      }
      taskIdx++;
      const finish = () => {
        fenBefore = board.chess.fen();
        const step = lesson.steps[stepIdx];
        if (taskIdx >= (step.tasks?.length ?? 0)) {
          feedback = { kind: 'ok', text: board.chess.isCheckmate() ? 'Checkmate! Well done.' : 'Correct! Well done.' };
          play('correct');
          speak(coach.id, feedback.text);
          board.setInteractive(undefined);
        } else feedback = { kind: 'info', text: 'Good. Keep going.' };
        render();
      };
      if (task.reply) setTimeout(() => (board.apply(task.reply!), finish()), 400);
      else finish();
    },
  });
  L.top.set({ name: coach.name, avatar: avatar(coach.id), chip: 'Coach' });
  L.bottom.set({ name: 'You', avatar: avatar() });

  const stepDone = () => !lesson.steps[stepIdx].tasks || taskIdx >= lesson.steps[stepIdx].tasks!.length;

  const render = () => {
    const step = lesson.steps[stepIdx];
    const last = stepIdx === lesson.steps.length - 1;
    clear(
      L.panel,
      panelHead(lesson.title, img3d('learn')),
      h(
        'div.panel-body',
        h('div.steps', lesson.steps.map((_, i) => h('i', { class: i < stepIdx ? 'done' : i === stepIdx ? 'cur' : '' }))),
        bubble(avatar(coach.id), h('div.head', `Step ${stepIdx + 1} of ${lesson.steps.length}`), step.text),
        feedback ? h('div.banner', { class: feedback.kind }, feedback.kind === 'ok' ? icon('check') : feedback.kind === 'bad' ? icon('x') : icon('bulb'), feedback.text) : null,
        step.tasks && !stepDone() ? h('div.dim', { style: 'font-weight:700' }, `${board.chess.turn() === 'w' ? 'White' : 'Black'} to move`) : null,
      ),
      h(
        'div.panel-foot',
        h(
          'div.row',
          stepIdx > 0 ? h('button.btn', { onclick: () => go(stepIdx - 1) }, icon('chevronLeft'), 'Back') : null,
          step.tasks && !stepDone()
            ? h('button.btn', { onclick: () => { const t = step.tasks![taskIdx]; feedback = { kind: 'info', text: t.hint ?? 'Look for forcing moves: checks, captures, threats.' }; board.shapes([arrow(t.accept[0], 'blue')]); render(); } }, icon('bulb'), 'Hint')
            : null,
        ),
        stepDone()
          ? h('button.btn.green.xl', { onclick: () => (last ? (setPref('lessonsDone', [...done(), lesson.id]), (location.hash = '#/lessons')) : go(stepIdx + 1)) }, last ? 'Complete Lesson' : 'Next')
          : null,
      ),
    );
  };

  const go = (i: number) => {
    stepIdx = i;
    taskIdx = 0;
    feedback = null;
    const step = lesson.steps[i];
    board.load(step.fen ?? new Chess().fen());
    board.shapes([]);
    board.orientation(step.orientation ?? (step.fen && step.tasks && new Chess(step.fen).turn() === 'b' ? 'black' : 'white'));
    fenBefore = board.chess.fen();
    board.setInteractive(step.tasks ? (board.chess.turn() === 'w' ? 'white' : 'black') : undefined);
    render();
    speak(coach.id, step.text);
  };
  const offSpeak = onSpeaking((who) => {
    L.top.speaking(who === coach.id);
    L.panel.querySelectorAll('.bubble .ava').forEach((a) => a.classList.toggle('speaking', who === coach.id));
  });
  window.addEventListener('hashchange', () => (offSpeak(), stopSpeaking()), { once: true });
  go(0);
}
