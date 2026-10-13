import './theme.css';
import { applyLook, avatar, img3d, sizeBoard } from './components';
import { clear, h } from './dom';
import { net } from './net';
import { homeView } from './views/home';
import { onlineView, gameView } from './views/online';
import { botsView } from './views/bots';
import { puzzlesView } from './views/puzzles';
import { analysisLanding, reviewView, freeAnalysis } from './views/review';
import { lessonsView, lessonView } from './views/lessons';
import { openingsView } from './views/openings';
import { coachesView } from './views/coaches';
import { profileView } from './views/profile';

export type View = (el: HTMLElement, params: string[], query: URLSearchParams) => void | (() => void);

const routes: [RegExp, View][] = [
  [/^\/?$/, homeView],
  [/^\/play(?:\/online)?$/, onlineView],
  [/^\/play\/online\/([\w-]+)$/, gameView],
  [/^\/play\/(?:bots?|local)$/, botsView],
  [/^\/puzzles$/, puzzlesView],
  [/^\/review$/, analysisLanding],
  [/^\/review\/([\w-]+)$/, reviewView],
  [/^\/analysis$/, freeAnalysis],
  [/^\/lessons$/, lessonsView],
  [/^\/lessons\/([\w-]+)$/, lessonView],
  [/^\/openings$/, openingsView],
  [/^\/coaches$/, coachesView],
  [/^\/profile$/, profileView],
];

const NAV: [string, string, string][] = [
  ['#/play', 'Play', 'play'],
  ['#/play/bots', 'Bots', 'bots'],
  ['#/puzzles', 'Puzzles', 'puzzles'],
  ['#/lessons', 'Learn', 'learn'],
  ['#/review', 'Review', 'review'],
  ['#/openings', 'Openings', 'openings'],
  ['#/coaches', 'Coaches', 'coaches'],
  ['#/profile', 'Your Mind', 'mind'],
];

applyLook();
const app = document.getElementById('app')!;
const main = h('main');
const me = h('div.me', h('img', { src: avatar(), alt: '' }), net.name || 'Guest');
const nav = h('nav.nav', NAV.map(([href, label, ico]) => h('a', { href }, h('img', { src: img3d(ico), alt: '' }), label)));
const sidebar = h(
  'aside.sidebar',
  h('a.logo', { href: '#/' }, h('img', { src: img3d('mind'), alt: '' }), h('span', 'ChessButFree')),
  nav,
  h(
    'div.bottom',
    me,
    h('a.btn.green.sm', { href: '#/play' }, 'Play Now'),
    h('div.tiny', 'Free & open source · ', h('a', { href: 'https://github.com/whoisjaso/chess', target: '_blank' }, 'GitHub')),
  ),
);
app.append(h('div.shell', sidebar, main));

let cleanup: void | (() => void);
function route(): void {
  const [path, qs] = location.hash.slice(1).split('?');
  const p = path || '/';
  cleanup?.();
  document.querySelectorAll('.modal-back').forEach((m) => m.remove());
  let best = '';
  for (const a of nav.querySelectorAll('a')) {
    const href = a.getAttribute('href')!.slice(1);
    if ((p === href || p.startsWith(href + '/') || (href === '/play' && p.startsWith('/play/online'))) && href.length > best.length) best = href;
  }
  for (const a of nav.querySelectorAll('a')) a.classList.toggle('active', a.getAttribute('href')!.slice(1) === best);
  me.lastChild!.textContent = net.name || 'Guest';
  for (const [re, view] of routes) {
    const m = p.match(re);
    if (m) {
      clear(main);
      sizeBoard(false);
      cleanup = view(main, m.slice(1), new URLSearchParams(qs));
      window.scrollTo(0, 0);
      return;
    }
  }
  clear(main, h('div.page', h('h1', 'Page not found'), h('a.btn.green', { href: '#/' }, 'Home')));
}
window.addEventListener('hashchange', route);
route();
