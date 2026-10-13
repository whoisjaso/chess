import type { Classification } from '@chessbutfree/core';
import { Chess } from 'chess.js';
import { clear, fmtClock, h } from './dom';
import { icon, tierIcon } from './icons';
import { pref, setPref } from './store';

/** Base URL for static assets, so the app also works when hosted under a sub-path. */
export const BASE = import.meta.env.BASE_URL;

/* ------------------------------------------------------------------ avatars */

const GUEST =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#5d5a57"/><path fill="#8b8987" d="M20 8a5 5 0 0 1 3.2 8.8c1.8.8 3 2.2 3 3.7h-2.6l2.2 7.5h-11.6l2.2-7.5h-2.6c0-1.5 1.2-2.9 3-3.7A5 5 0 0 1 20 8zM10 30h20v4H10z"/></svg>`,
  );

const AVATAR_IDS = new Set(['showman', 'diplomat', 'bookworm', 'professor', 'underdog', 'warlord', 'kiyo', 'lumen', 'karasu', 'tenka', 'flint', 'shuji', 'namenlos']);

/** Bots and coaches have rendered portraits; people get the default pawn avatar. */
export function avatar(id?: string): string {
  return id && AVATAR_IDS.has(id) ? `${BASE}img/avatars/${id}.png` : GUEST;
}

export const img3d = (name: string) => `${BASE}img/icons/${name}.png`;

/* ------------------------------------------------------------------ app-wide board look */

export const PIECE_SETS: [string, string][] = [
  ['cburnett', 'Classic'],
  ['neo', 'Neo'],
  ['merida', 'Merida'],
  ['chessnut', 'Chessnut'],
  ['fantasy', 'Fantasy'],
  ['spatial', 'Spatial'],
  ['mpchess', 'Minimal'],
  ['3d', '3D'],
];

export function pieceSet(): string {
  const s = pref('pieceSet', 'cburnett');
  return PIECE_SETS.some(([id]) => id === s) ? s : 'cburnett';
}

/** URL of a piece image in the current set ('wP', 'bK', ...). */
export function pieceUrl(code: string): string {
  const set = pieceSet();
  return `${BASE}img/pieces/${set}/${code}.${set === '3d' ? 'png' : 'svg'}`;
}

let pieceStyle: HTMLStyleElement | null = null;
export function applyLook(): void {
  const b = document.body.classList;
  for (const c of [...b]) if (c.startsWith('theme-') || c === 'no-coords') b.remove(c);
  b.add(`theme-${pref('boardTheme', 'green')}`);
  if (!pref('coords', true)) b.add('no-coords');
  const names: Record<string, string> = { P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' };
  const css = ['w', 'b']
    .flatMap((c) => Object.entries(names).map(([l, n]) => `.cg-wrap piece.${n}.${c === 'w' ? 'white' : 'black'}{background-image:url('${pieceUrl(c + l)}')}`))
    .join('\n');
  pieceStyle ??= document.head.appendChild(document.createElement('style'));
  pieceStyle.textContent = css;
}

/* ------------------------------------------------------------------ board layout */

export interface PlayerBar {
  el: HTMLElement;
  speaking(on: boolean): void;
  extra(node: Node | null): void;
  set(p: { name: string; rating?: number | string; avatar?: string; chip?: string }): void;
  clock(ms: number | null, active?: boolean): void;
  captured(fen: string, side: 'w' | 'b'): void;
}

export function playerBar(): PlayerBar {
  const ava = h('img.ava', { src: GUEST, alt: '' });
  const name = h('div.name');
  const captured = h('div.captured');
  const clock = h('div.clock.hidden', '0:00');
  const extraBox = h('div.bar-extra');
  const el = h('div.player-bar', ava, h('div.who', name, captured), extraBox, clock);
  return {
    el,
    speaking(on) {
      ava.classList.toggle('speaking', on);
    },
    extra(node) {
      clear(extraBox, node);
    },
    set(p) {
      ava.src = p.avatar ?? GUEST;
      clear(name, p.name, p.rating !== undefined ? h('span.rating', `(${p.rating})`) : null, p.chip ? h('span.chip', p.chip) : null);
    },
    clock(ms, active) {
      if (ms === null) {
        clock.className = 'clock hidden';
        return;
      }
      clock.textContent = fmtClock(ms);
      clock.className = `clock${active ? ' active' : ''}${ms < 20_000 ? ' low' : ''}`;
    },
    captured(fen, side) {
      clear(captured, ...capturedPieces(fen, side));
    },
  };
}

const START_COUNT: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

/** Pieces `side` has captured, plus material advantage ("+2"). */
export function capturedPieces(fen: string, side: 'w' | 'b'): Node[] {
  const board = fen.split(' ')[0];
  const count = (ch: string) => [...board].filter((c) => c === ch).length;
  const opp = side === 'w' ? 'b' : 'w';
  const out: Node[] = [];
  let mine = 0;
  let theirs = 0;
  for (const t of ['p', 'n', 'b', 'r', 'q']) {
    const oppHas = count(opp === 'w' ? t.toUpperCase() : t);
    const meHas = count(side === 'w' ? t.toUpperCase() : t);
    mine += meHas * VALUE[t];
    theirs += oppHas * VALUE[t];
    const taken = Math.max(0, START_COUNT[t] - oppHas);
    for (let i = 0; i < taken; i++) out.push(h('img', { src: pieceUrl(`${opp}${t.toUpperCase()}`), alt: '' }));
  }
  if (mine > theirs) out.push(h('span.adv', `+${mine - theirs}`));
  return out;
}

export interface BoardLayout {
  root: HTMLElement;
  boardHost: HTMLElement;
  top: PlayerBar;
  bottom: PlayerBar;
  panel: HTMLElement;
  bars: HTMLElement;
  gear: HTMLElement;
}

/** Board column (player bars + board + optional eval/frame bars) and right panel, sized like Chess.com. */
export function boardLayout(opts: { bars?: boolean; onSettings?: () => void } = {}): BoardLayout {
  const top = playerBar();
  const bottom = playerBar();
  const boardHost = h('div.board-host');
  const bars = h('div.bars');
  const gear = h('button.btn.flat.icon-btn.board-gear', { title: 'Board settings', onclick: () => settingsModal(opts.onSettings) }, icon('gear'));
  const panel = h('div.panel');
  const boardRow = h('div.board-row', opts.bars ? bars : null, h('div', { style: 'position:relative' }, boardHost, gear));
  const root = h('div.board-layout', h('div.board-col', top.el, boardRow, bottom.el), panel);
  sizeBoard(!!opts.bars);
  return { root, boardHost, top, bottom, panel, bars, gear };
}

let resizeBound = false;
let lastBars = false;
export function sizeBoard(withBars = lastBars): void {
  lastBars = withBars;
  const wide = window.innerWidth > 1000;
  const sidebar = wide ? 145 : 0;
  const panel = wide ? 420 + 16 : 0;
  const barsW = withBars ? 38 : 0;
  const availW = window.innerWidth - sidebar - panel - barsW - (wide ? 100 : 24);
  const availH = wide ? window.innerHeight - 2 * 46 - 36 : 10_000;
  const size = Math.max(280, Math.floor(Math.min(availW, availH, 860) / 8) * 8);
  document.documentElement.style.setProperty('--board', `${size}px`);
  if (!resizeBound) {
    resizeBound = true;
    window.addEventListener('resize', () => {
      sizeBoard();
      document.body.dispatchEvent(new Event('chessground.resize'));
    });
  }
}

/* ------------------------------------------------------------------ panel parts */

export function panelHead(title: string, img?: string): HTMLElement {
  return h('div.panel-head', img ? h('img', { src: img, alt: '' }) : null, title);
}

export function tabs<T extends string>(items: { id: T; label: string; icon: Parameters<typeof icon>[0] }[], current: T, onPick: (id: T) => void): HTMLElement {
  return h(
    'div.panel-tabs',
    items.map((t) => h('button', { class: t.id === current ? 'on' : '', onclick: () => onPick(t.id) }, icon(t.icon), t.label)),
  );
}

export function bubble(avatarSrc: string, ...content: (Node | string | null)[]): HTMLElement {
  return h('div.bubble', h('img.ava', { src: avatarSrc, alt: '' }), h('div.say', ...content));
}

export function moveTable(sans: string[], current: number, onPick: (ply: number) => void, badge?: (i: number) => Classification | undefined): HTMLElement {
  const el = h('div.moves');
  if (!sans.length) el.append(h('div.empty', 'No moves yet'));
  for (let i = 0; i < sans.length; i += 2) {
    const cell = (j: number) =>
      j < sans.length
        ? h('div', h('span.mv', { class: j + 1 === current ? 'cur' : '', onclick: () => onPick(j + 1) }, badge?.(j) ? tierIcon(badge(j)!) : null, sans[j]))
        : h('div');
    el.append(h('div.mrow', h('div.no', `${i / 2 + 1}.`), cell(i), cell(i + 1)));
  }
  queueMicrotask(() => el.querySelector('.cur')?.scrollIntoView({ block: 'nearest' }));
  return el;
}

export function navButtons(go: (where: 'first' | 'prev' | 'next' | 'last') => void, extra?: Node): HTMLElement {
  return h(
    'div.navbar',
    h('button.btn.sm', { title: 'First', onclick: () => go('first') }, icon('first')),
    h('button.btn.sm', { title: 'Previous', onclick: () => go('prev') }, icon('chevronLeft')),
    h('button.btn.sm', { title: 'Next', onclick: () => go('next') }, icon('chevronRight')),
    h('button.btn.sm', { title: 'Last', onclick: () => go('last') }, icon('last')),
    extra ?? null,
  );
}

/* ------------------------------------------------------------------ time controls */

export interface TC {
  initialMs: number;
  incrementMs: number;
}
export const TC_CATS: { cat: 'Bullet' | 'Blitz' | 'Rapid'; icon: 'bullet' | 'blitz' | 'rapid'; opts: [string, TC][] }[] = [
  { cat: 'Bullet', icon: 'bullet', opts: [['1 min', { initialMs: 60_000, incrementMs: 0 }], ['1 | 1', { initialMs: 60_000, incrementMs: 1000 }], ['2 | 1', { initialMs: 120_000, incrementMs: 1000 }]] },
  { cat: 'Blitz', icon: 'blitz', opts: [['3 min', { initialMs: 180_000, incrementMs: 0 }], ['3 | 2', { initialMs: 180_000, incrementMs: 2000 }], ['5 min', { initialMs: 300_000, incrementMs: 0 }]] },
  { cat: 'Rapid', icon: 'rapid', opts: [['10 min', { initialMs: 600_000, incrementMs: 0 }], ['15 | 10', { initialMs: 900_000, incrementMs: 10_000 }], ['30 min', { initialMs: 1_800_000, incrementMs: 0 }]] },
];

export function tcLabel(tc: TC): string {
  for (const c of TC_CATS) for (const [l, t] of c.opts) if (t.initialMs === tc.initialMs && t.incrementMs === tc.incrementMs) return `${l} (${c.cat})`;
  return `${tc.initialMs / 60000} | ${tc.incrementMs / 1000}`;
}

export function tcIcon(tc: TC): 'bullet' | 'blitz' | 'rapid' {
  const est = tc.initialMs / 1000 + (40 * tc.incrementMs) / 1000;
  return est < 180 ? 'bullet' : est < 480 ? 'blitz' : 'rapid';
}

/** Collapsed: a select-style button. Expanded: Chess.com's time-control grid. */
export function tcPicker(current: TC, onPick: (tc: TC) => void, extraOpts?: [string, TC | null][]): HTMLElement {
  const wrap = h('div');
  let open = false;
  const render = () => {
    clear(
      wrap,
      h('button.select', { onclick: () => ((open = !open), render()) }, icon(tcIcon(current)), tcLabel(current), icon('chevronDown')),
      open
        ? h(
            'div.tc-grid',
            { style: 'margin-top:12px' },
            TC_CATS.map((c) =>
              h(
                'div',
                h('div.cat', icon(c.icon), c.cat),
                h(
                  'div.opts',
                  { style: 'margin-top:6px' },
                  c.opts.map(([l, t]) =>
                    h('button', { class: t.initialMs === current.initialMs && t.incrementMs === current.incrementMs ? 'on' : '', onclick: () => ((current = t), (open = false), onPick(t), render()) }, l),
                  ),
                ),
              ),
            ),
            extraOpts?.length ? h('div.opts', extraOpts.map(([l]) => h('button', { onclick: () => ((open = false), render()) }, l))) : null,
          )
        : null,
    );
  };
  render();
  return wrap;
}

/* ------------------------------------------------------------------ modal + settings */

export function modal(content: Node, opts: { onClose?: () => void; closable?: boolean } = {}): () => void {
  const close = () => {
    back.remove();
    opts.onClose?.();
  };
  const back = h(
    'div.modal-back',
    { onclick: (e: Event) => e.target === back && opts.closable !== false && close() },
    h('div.modal', opts.closable === false ? null : h('button.x', { onclick: close, title: 'Close' }, icon('x')), content),
  );
  document.body.append(back);
  return close;
}

const THEMES: [string, string, string][] = [
  ['green', '#ebecd0', '#739552'],
  ['brown', '#f0d9b5', '#b58863'],
  ['blue', '#dee3e6', '#8ca2ad'],
  ['night', '#a3a9b7', '#5c6577'],
];

export function settingsModal(onChange?: () => void): void {
  const body = h('div.modal-body');
  const render = () => {
    const theme = pref('boardTheme', 'green');
    const set = pieceSet();
    const toggle = (key: string, label: string, def: boolean) =>
      h('div.opt-row', label, h('div.seg', [true, false].map((v) => h('button', { class: pref(key, def) === v ? 'on' : '', onclick: () => (setPref(key, v), applyLook(), render(), onChange?.()) }, v ? 'On' : 'Off'))));
    clear(
      body,
      h('h2', { style: 'margin:0;font-size:22px;font-weight:900' }, 'Board settings'),
      h('div.opt-row', 'Board', h('div.seg', THEMES.map(([id, a, b]) => h('div.swatch', { class: theme === id ? 'on' : '', title: id, onclick: () => (setPref('boardTheme', id), applyLook(), render()) }, h('i', { style: `background:${a}` }), h('i', { style: `background:${b}` }), h('i', { style: `background:${b}` }), h('i', { style: `background:${a}` }))))),
      h(
        'div.opt-row',
        'Pieces',
        h(
          'div.seg',
          PIECE_SETS.map(([id, label]) => h('button', { class: set === id ? 'on' : '', onclick: () => (setPref('pieceSet', id), applyLook(), render()) }, label)),
        ),
      ),
      toggle('coords', 'Coordinates', true),
      toggle('sound', 'Sounds', true),
      h('div.report', h('div.section', 'Voices')),
      toggle('voice', 'Coach & bot voices', true),
      toggle('hdVoices', 'HD neural voices', false),
      h('p.dim', { style: 'margin:0;font-size:12.5px' }, 'HD voices run a neural speech model on your device; each character’s voice downloads once (20–60 MB).'),
      h('div.report', h('div.section', 'Voice chat (online games)')),
      toggle('micOn', 'My mic', true),
      toggle('hearOpponent', 'Opponent’s voice', true),
      h('p.dim', { style: 'margin:0;font-size:12.5px' }, 'Voice chat is peer-to-peer. Your browser asks for mic permission once.'),
    );
  };
  render();
  modal(body);
}

/** Game-over dialog (Chess.com layout): result, players, Game Review CTA, rematch. */
export function gameOverModal(p: {
  title: string;
  subtitle: string;
  white: { name: string; avatar: string; rating?: string };
  black: { name: string; avatar: string; rating?: string };
  winner?: 'w' | 'b';
  coachAvatar: string;
  onReview: () => void;
  actions: [string, () => void][];
}): () => void {
  const pl = (side: 'w' | 'b') => {
    const x = side === 'w' ? p.white : p.black;
    return h('div.p', { class: p.winner === side ? 'win' : '' }, h('img', { src: x.avatar, alt: '' }), x.name, x.rating ? h('div.dim', x.rating) : null);
  };
  let close = () => {};
  const content = h(
    'div',
    h('div.over-head', h('h2', p.title), h('p', p.subtitle)),
    h('div.over-players', pl('w'), h('div.vs', 'vs'), pl('b')),
    h(
      'div.modal-body',
      h('button.btn.green.lg', { onclick: () => (close(), p.onReview()) }, h('img', { src: p.coachAvatar, alt: '', style: 'border-radius:4px' }), 'Game Review'),
      h('div', { style: 'display:flex;gap:10px' }, p.actions.map(([label, fn]) => h('button.btn', { style: 'flex:1', onclick: () => (close(), fn()) }, label))),
    ),
  );
  close = modal(content);
  return close;
}

/** Small read-only board preview (used on cards and the home page). */
export function miniBoardFen(fen: string): string {
  return new Chess(fen).fen();
}
