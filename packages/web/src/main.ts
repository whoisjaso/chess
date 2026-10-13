import './style.css';
import { clear, h } from './dom';
import { homeView } from './views/home';
import { playView } from './views/play';
import { reviewView } from './views/review';
import { lessonsView, lessonView } from './views/lessons';
import { openingsView } from './views/openings';
import { coachesView } from './views/coaches';
import { profileView } from './views/profile';

export type View = (el: HTMLElement, params: string[], query: URLSearchParams) => void | (() => void);

const routes: [RegExp, View][] = [
  [/^\/?$/, homeView],
  [/^\/play(?:\/(bot|online|local))?(?:\/([\w-]+))?$/, playView],
  [/^\/review(?:\/([\w-]+))?$/, reviewView],
  [/^\/lessons$/, lessonsView],
  [/^\/lessons\/([\w-]+)$/, lessonView],
  [/^\/openings$/, openingsView],
  [/^\/coaches$/, coachesView],
  [/^\/profile$/, profileView],
];

const NAV: [string, string][] = [
  ['#/', 'Home'],
  ['#/play', 'Play'],
  ['#/review', 'Review'],
  ['#/lessons', 'Lessons'],
  ['#/openings', 'Openings'],
  ['#/coaches', 'Coaches'],
  ['#/profile', 'Your mind'],
];

const app = document.getElementById('app')!;
const main = h('main');
const nav = h(
  'nav.side',
  h('a.brand', { href: '#/' }, h('span.eye'), 'Mindboard'),
  NAV.map(([href, label]) => h('a.item', { href }, label)),
  h('div.foot', 'Free & open source · AGPL-3.0', h('br'), h('a', { href: 'https://github.com/whoisjaso/chess', target: '_blank' }, 'Source')),
);
app.append(h('div.shell', nav, main));

let cleanup: void | (() => void);
function route(): void {
  const [path, qs] = location.hash.slice(1).split('?');
  cleanup?.();
  for (const a of nav.querySelectorAll('a.item')) {
    const href = a.getAttribute('href')!.slice(1);
    a.classList.toggle('active', href === '/' ? path === '/' || path === '' : (path ?? '').startsWith(href));
  }
  for (const [re, view] of routes) {
    const m = (path || '/').match(re);
    if (m) {
      clear(main);
      cleanup = view(main, m.slice(1), new URLSearchParams(qs));
      window.scrollTo(0, 0);
      return;
    }
  }
  clear(main, h('h1', 'Not found'), h('a', { href: '#/' }, 'Home'));
}
window.addEventListener('hashchange', route);
route();
