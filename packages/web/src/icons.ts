import type { Classification } from '@chessbutfree/core';

/** Inline SVG icon library (original artwork). Returns an SVGElement. */
export function svg(markup: string, cls = ''): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  const el = t.content.firstElementChild as SVGSVGElement;
  if (cls) el.classList.add(...cls.split(' '));
  return el;
}

const S = (body: string, vb = '0 0 24 24') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="currentColor">${body}</svg>`;

export const ICON = {
  plus: S('<path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z"/>'),
  board: S('<path d="M3 3h18v18H3zm2 2v3.5h3.5V5zm3.5 3.5V12H12V8.5zM12 5v3.5h3.5V5zm3.5 3.5V12H19V8.5zM5 12v3.5h3.5V12zm3.5 3.5V19H12v-3.5zM12 12v3.5h3.5V12zm3.5 3.5V19H19v-3.5z"/>'),
  players: S('<path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7 0a3.5 3.5 0 1 0-1.2-6.8A6 6 0 0 1 16 11zM1 20c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5v1H1zm17.5 1v-1c0-2.2-.9-4-2.4-5.3 3.3.3 6.9 2.2 6.9 5.3v1z"/>'),
  chevronDown: S('<path d="M5.3 8.3 12 15l6.7-6.7 1.4 1.4L12 17.8 3.9 9.7z"/>'),
  chevronLeft: S('<path d="M15.7 4.3 8 12l7.7 7.7-1.4 1.4L5.2 12l9.1-9.1z"/>'),
  chevronRight: S('<path d="m8.3 4.3 7.7 7.7-7.7 7.7 1.4 1.4 9.1-9.1-9.1-9.1z"/>'),
  first: S('<path d="M5 4h2v16H5zm14.7.3L12 12l7.7 7.7-1.4 1.4L9.2 12l9.1-9.1z"/>'),
  last: S('<path d="M17 4h2v16h-2zM4.3 4.3 12 12l-7.7 7.7 1.4 1.4 9.1-9.1-9.1-9.1z"/>'),
  flip: S('<path d="M7 3 2.5 7.5 7 12V9h9a3 3 0 0 1 0 6h-1v2h1a5 5 0 0 0 0-10H7zm10 18 4.5-4.5L17 12v3H8a3 3 0 0 1 0-6h1V7H8a5 5 0 0 0 0 10h9z"/>'),
  gear: S('<path d="M10.3 2h3.4l.5 2.6c.6.2 1.2.5 1.7.9l2.5-.9 1.7 2.9-2 1.7c.1.6.1 1.3 0 1.9l2 1.7-1.7 2.9-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6c-.6-.2-1.2-.5-1.7-.9l-2.5.9-1.7-2.9 2-1.7a6 6 0 0 1 0-1.9l-2-1.7 1.7-2.9 2.5.9c.5-.4 1.1-.7 1.7-.9zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" transform="translate(0 2) scale(1 .92)"/>'),
  flag: S('<path d="M5 2h2v20H5zm3 1h11l-2.5 4.5L19 12H8z"/>'),
  half: S('<text x="12" y="17" font-size="15" font-weight="900" text-anchor="middle" font-family="Figtree Variable,sans-serif">½</text>'),
  x: S('<path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/>'),
  check: S('<path d="m9 16.2-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4z"/>'),
  bulb: S('<path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zM9 19h6v1.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 20.5z"/>'),
  undo: S('<path d="M12.5 8c-2.6 0-5 1-6.9 2.6L2 7v9h9l-3.6-3.6A8 8 0 0 1 20.1 16l2.4-.8A10.5 10.5 0 0 0 12.5 8z"/>'),
  retry: S('<path d="M12 4V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z"/>'),
  star: S('<path d="m12 2 3 6.3 6.9.9-5 4.8 1.2 6.9L12 17.6 5.9 20.9 7.1 14l-5-4.8 6.9-.9z"/>'),
  share: S('<path d="M18 16a3 3 0 0 0-2.3 1.1l-6.8-3.5a3 3 0 0 0 0-1.2l6.8-3.5A3 3 0 1 0 15 7l-6.8 3.5a3 3 0 1 0 0 3L15 17a3 3 0 1 0 3-1z"/>'),
  search: S('<path d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>'),
  list: S('<path d="M3 5h3v3H3zm5 0h13v3H8zM3 10.5h3v3H3zm5 0h13v3H8zM3 16h3v3H3zm5 0h13v3H8z"/>'),
  link: S('<path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5 1.4 1.4-3.5 3.5a1 1 0 0 1-1.4 0zM8 18a3 3 0 0 1-2.1-5.1l2.8-2.8 1.4 1.4-2.8 2.8a1 1 0 1 0 1.4 1.4l2.8-2.8 1.4 1.4-2.8 2.8A3 3 0 0 1 8 18zm6-2.6-1.4-1.4 2.8-2.8a1 1 0 1 0-1.4-1.4L11.2 12 9.8 10.6l2.8-2.8a3 3 0 0 1 4.2 4.2z"/>'),
  trophy: S('<path d="M7 2h10v2h4v3a5 5 0 0 1-4.3 5A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 7.3 12 5 5 0 0 1 3 7V4h4zm10 4v4a3 3 0 0 0 2-3V6zM5 6v1a3 3 0 0 0 2 3V6z"/>'),
  robot: S('<path d="M11 2h2v2h4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4zM8.5 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM9 14v1.5h6V14zM6 19h12v3H6z"/>'),
  handshake: S('<path d="M2 6h5l3 2h4l3-2h5v8h-3l-5 5a2 2 0 0 1-3 0l-1-1-1 1a2 2 0 0 1-3-3H3a1 1 0 0 1-1-1zm9 4-2 2 3 3 1-1z"/>'),
  swords: S('<path d="m3 3 6.5 6.5-1.4 1.4L2 4.8V3zm18 0v1.8l-9.6 9.6 1.5 1.5-1.4 1.4-1.6-1.5-2.3 2.3.7.7-1.4 1.4-3.5-3.5 1.4-1.4.7.7 2.3-2.3-1.5-1.6 1.4-1.4 1.5 1.5L19.2 3zm-4.6 12.3 1.4-1.4 1.5 1.5 1.4-1.4 1.4 1.4-1.4 1.4.7.7-1.4 1.4-.7-.7-1.4 1.4-1.4-1.4 1.4-1.4z"/>'),
  mic: S('<path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.9V21h-2v-3.1A7 7 0 0 1 5 11z"/>'),
  micOff: S('<path d="m3.3 2 18.7 18.7-1.4 1.4-4.3-4.3a7 7 0 0 1-2.3.7V21h-2v-2.6A7 7 0 0 1 5 11h2a5 5 0 0 0 7.6 4.3l-1.5-1.5A3 3 0 0 1 9 11V8.6L1.9 3.4zM12 2a3 3 0 0 1 3 3v5.2L9.2 4.4A3 3 0 0 1 12 2zm5 9h2c0 1.3-.3 2.5-.9 3.5l-1.5-1.5c.3-.6.4-1.3.4-2z"/>'),
  speaker: S('<path d="M3 9h4l5-4v14l-5-4H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/>'),
  speakerOff: S('<path d="M3 9h4l5-4v14l-5-4H3zm13.6 3 2.7-2.7 1.4 1.4-2.7 2.7 2.7 2.7-1.4 1.4-2.7-2.7-2.7 2.7-1.4-1.4 2.7-2.7-2.7-2.7 1.4-1.4z"/>'),
  // time-control categories
  bullet: S('<path d="M19 3c1.1 0 2 .9 2 2 0 3-2 6-5 8.5L9.5 20 4 14.5l6.5-6.5C13 5 16 3 19 3zM3 17l4 4H3z"/>'),
  blitz: S('<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>'),
  rapid: S('<path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm-1 2h2v4.6l3.2 3.2-1.4 1.4L11 12.4z"/>'),
  daily: S('<path d="M11 1h2v3h-2zm0 19h2v3h-2zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM1 11h3v2H1zm19 0h3v2h-3zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z"/>'),
  stopwatch: S('<path d="M9 1h6v2H9zm3 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm-1 2h2v6h-2zm7.3-4.7 1.4 1.4-1.4 1.4-1.4-1.4z"/>'),
};

/* ---------------------------------------------------------------- move-rating tier badges */

const TIER: Record<Classification, { color: string; glyph: string }> = {
  brilliant: { color: '#1baaa6', glyph: 'text:!!' },
  great: { color: '#5b8baf', glyph: 'text:!' },
  best: { color: '#81b64c', glyph: '<path d="m12 4.6 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z"/>' },
  excellent: { color: '#96bc4b', glyph: '<path d="M10.2 6.2 12 4c1.3.2 2 1.3 1.6 2.6L13 9h4.2c1 0 1.8 1 1.5 2l-1.4 5.2c-.2.8-1 1.3-1.8 1.3H9.5V10zM5.5 10h2.6v7.5H5.5z"/>' },
  good: { color: '#96af8b', glyph: '<path d="m10.3 15.6-3.6-3.6 1.6-1.6 2 2 5.4-5.4 1.6 1.6z"/>' },
  book: { color: '#a88764', glyph: '<path d="M5.5 6.5c2.2-.6 4.5-.3 6.5 1 2-1.3 4.3-1.6 6.5-1v10.8c-2.2-.6-4.5-.3-6.5 1-2-1.3-4.3-1.6-6.5-1zM11.2 8.9c-1.4-.7-2.9-.9-4.3-.6v7.3c1.4-.2 2.9 0 4.3.6z"/>' },
  forced: { color: '#97a1ab', glyph: '<path d="M6 11h8.2L11 7.8l1.4-1.4L18 12l-5.6 5.6-1.4-1.4 3.2-3.2H6z"/>' },
  inaccuracy: { color: '#f0c15c', glyph: 'text:?!' },
  mistake: { color: '#e6912c', glyph: 'text:?' },
  miss: { color: '#ee6b55', glyph: '<path d="m8.2 6.8 3.8 3.8 3.8-3.8 1.4 1.4-3.8 3.8 3.8 3.8-1.4 1.4-3.8-3.8-3.8 3.8-1.4-1.4 3.8-3.8-3.8-3.8z"/>' },
  blunder: { color: '#ca3431', glyph: 'text:??' },
};

export const TIER_LABEL: Record<Classification, string> = {
  brilliant: 'Brilliant',
  great: 'Great',
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  book: 'Book',
  forced: 'Forced',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  miss: 'Miss',
  blunder: 'Blunder',
};

export const tierColor = (c: Classification) => TIER[c].color;

/** Round badge for a move-rating tier (used on the board, move list, report, coach bubble). */
export function tierIcon(c: Classification): SVGSVGElement {
  const { color, glyph } = TIER[c];
  const inner = glyph.startsWith('text:')
    ? `<text x="12" y="${glyph.length > 6 ? 16.3 : 16.6}" text-anchor="middle" font-family="Figtree Variable,system-ui,sans-serif" font-weight="900" font-size="${glyph.length > 6 ? 11.5 : 13}" letter-spacing="-1" fill="#fff">${glyph.slice(5)}</text>`
    : `<g fill="#fff">${glyph}</g>`;
  return svg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12.6" r="11" fill="rgba(0,0,0,.28)"/><circle cx="12" cy="12" r="11" fill="${color}"/>${inner}</svg>`,
  );
}

export const icon = (name: keyof typeof ICON) => svg(ICON[name]);
