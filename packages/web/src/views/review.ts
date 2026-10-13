import {
  ARCHETYPE_INFO,
  ARCHETYPES,
  coachReport,
  coachSay,
  coachSummary,
  COACHES,
  pliesFromPgn,
  readMinds,
  reviewGame,
  type GameMeta,
  type MindReport,
  type PlayerProfile,
  type PlyRecord,
  type PositionEval,
  type GameReview,
} from '@mindboard/core';
import { arrow, Board } from '../board';
import { clear, h } from '../dom';
import { engine } from '../engine';
import type { View } from '../main';
import { getGame, listGames, newId, pref, saveGame, setPref, type StoredGame } from '../store';
import { badge, CLS, moveList } from '../ui';

const PROFILE_KEY = 'mindboard.profiles.v1';

/** Cache of each reviewed game's mind profile for "Your mind" aggregation. */
export function storedProfiles(): Record<string, { at: number; you: 'w' | 'b'; profile: PlayerProfile; accuracy: number }> {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function rememberProfile(g: StoredGame, review: GameReview, mind: MindReport): void {
  if (!g.you) return;
  const all = storedProfiles();
  all[g.id] = { at: g.at, you: g.you, profile: g.you === 'w' ? mind.white : mind.black, accuracy: g.you === 'w' ? review.white.accuracy : review.black.accuracy };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: profile just won't aggregate */
  }
}

export const reviewView: View = (el, [id]) => {
  const g = id ? getGame(id) : undefined;
  if (g) return analyse(el, g);
  importScreen(el);
};

function importScreen(el: HTMLElement): void {
  const ta = h('textarea', { placeholder: 'Paste a PGN — from Mindboard, Chess.com, or Lichess. [%clk] comments are used for think-time psychology.' });
  const err = h('div.small', { style: 'color:var(--danger)' });
  el.append(
    h('h1', 'Game Review'),
    h('p.muted', 'Board review (brilliant → blunder, accuracy) plus Mind Read: script breaks, frame, impulse, tilt, pressure, and the mask behind the moves. Runs on your device.'),
    ta,
    h(
      'div.row',
      { style: 'margin-top:10px' },
      h(
        'button.primary',
        {
          onclick: () => {
            try {
              const { plies, meta } = pliesFromPgn(ta.value);
              if (!plies.length) throw new Error('No moves found');
              const game: StoredGame = { id: newId(), at: Date.now(), plies, meta, source: 'import' };
              saveGame(game);
              location.hash = `#/review/${game.id}`;
            } catch (e) {
              err.textContent = `Could not read that PGN: ${(e as Error).message}`;
            }
          },
        },
        'Review',
      ),
      err,
    ),
    h('h2', 'Your games'),
    h(
      'div.grid',
      listGames().map((x) =>
        h('div.card.link', { onclick: () => (location.hash = `#/review/${x.id}`) }, h('h3', `${x.meta.white ?? '?'} vs ${x.meta.black ?? '?'}`), h('div.muted.small', `${x.meta.result ?? '*'} · ${x.source} · ${new Date(x.at).toLocaleString()}`)),
      ),
    ),
  );
}

async function evaluate(plies: PlyRecord[], depth: number, onProgress: (i: number, n: number) => void, cancelled: () => boolean): Promise<(PositionEval | null)[]> {
  const fens = [plies[0].fenBefore, ...plies.map((p) => p.fenAfter)];
  const out: (PositionEval | null)[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (cancelled()) break;
    out.push(await engine().analyse(fens[i], { depth, multipv: 2 }));
    onProgress(i + 1, fens.length);
  }
  return out;
}

function analyse(el: HTMLElement, g: StoredGame): () => void {
  let cancelled = false;
  const depth = pref('reviewDepth', 12);
  const bar = h('div');
  const label = h('div.muted.small', 'Analysing with Stockfish 17.1 on your device…');
  el.append(h('h1', `${g.meta.white ?? 'White'} vs ${g.meta.black ?? 'Black'}`), label, h('div.progress', bar));
  const cacheKey = `mindboard.evals.${g.id}.${depth}`;
  let cached: (PositionEval | null)[] | null = null;
  try {
    cached = JSON.parse(sessionStorage.getItem(cacheKey) ?? 'null');
  } catch {
    cached = null;
  }
  const done = (evals: (PositionEval | null)[]) => {
    if (cancelled) return;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(evals));
    } catch {
      /* ignore */
    }
    const review = reviewGame(g.plies, evals, g.meta);
    const mind = readMinds(review, g.plies, g.meta);
    rememberProfile(g, review, mind);
    clear(el);
    render(el, g, review, mind);
  };
  if (cached && cached.length === g.plies.length + 1) done(cached);
  else
    evaluate(g.plies, depth, (i, n) => (bar.style.width = `${(100 * i) / n}%`), () => cancelled).then(done, (e) => (label.textContent = `Engine error: ${e}`));
  return () => {
    cancelled = true;
  };
}

function winBarHeight(review: GameReview, ply: number): number {
  return review.winSeries[ply] ?? 50;
}

function graph(review: GameReview, mind: MindReport, cur: number, pick: (ply: number) => void): SVGSVGElement {
  const W = 600;
  const H = 110;
  const n = review.winSeries.length - 1 || 1;
  const x = (i: number) => (i / n) * W;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('graph');
  const path = (d: string, attrs: Record<string, string>) => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v);
    svg.append(p);
  };
  const win = review.winSeries.map((w, i) => `${x(i)},${H - (w / 100) * H}`).join(' L');
  path(`M0,${H} L${win} L${W},${H} Z`, { fill: '#e6e9ee', opacity: '0.85' });
  path(`M0,${H / 2} L${W},${H / 2}`, { stroke: '#555', 'stroke-dasharray': '4 4' });
  const frame = [0, ...mind.frame.map((f) => f.frame)].map((f, i) => `${x(i)},${H / 2 - (f * H) / 2}`).join(' L');
  path(`M${frame}`, { stroke: '#46c2b4', 'stroke-width': '2', fill: 'none' });
  for (const r of review.plies) {
    if (['blunder', 'mistake', 'miss', 'brilliant', 'great'].includes(r.classification)) {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', String(x(r.ply)));
      c.setAttribute('cy', String(H - (review.winSeries[r.ply] / 100) * H));
      c.setAttribute('r', '4');
      c.setAttribute('fill', CLS[r.classification].color);
      svg.append(c);
    }
  }
  const line = document.createElementNS(ns, 'line');
  line.setAttribute('x1', String(x(cur)));
  line.setAttribute('x2', String(x(cur)));
  line.setAttribute('y1', '0');
  line.setAttribute('y2', String(H));
  line.setAttribute('stroke', '#e2a34a');
  svg.append(line);
  svg.addEventListener('click', (e) => {
    const rect = svg.getBoundingClientRect();
    pick(Math.round(((e.clientX - rect.left) / rect.width) * n));
  });
  return svg;
}

function profileCard(p: PlayerProfile, label: string, accuracy: number, coachLine: string): HTMLElement {
  return h(
    'div.card',
    h('h3', `${label}: ${p.name ?? ''}`),
    h('div.row', h('span.pill', `Accuracy ${accuracy.toFixed(1)}`), h('span.pill', `Initiative ${Math.round(100 * p.initiativeShare)}%`), h('span.pill', `Identity ${p.identity ?? '—'}`), p.medianThinkMs ? h('span.pill', `Median think ${(p.medianThinkMs / 1000).toFixed(1)}s`) : null),
    h('h3', `Mask: ${ARCHETYPE_INFO[p.mask[0]].title} + ${ARCHETYPE_INFO[p.mask[1]].title}`),
    ARCHETYPES.map((a) => h('div.arch', h('span', ARCHETYPE_INFO[a].title), h('div.meter', h('div', { style: `width:${Math.round(100 * p.archetypes[a])}%` })), h('span.muted', `${Math.round(100 * p.archetypes[a])}%`))),
    h('p.small.muted', ARCHETYPE_INFO[p.mask[0]].board, ' ', h('i', ARCHETYPE_INFO[p.mask[0]].inverse)),
    p.evidence[p.mask[0]].length ? h('details.small', h('summary', 'Evidence'), h('ul', p.evidence[p.mask[0]].map((e) => h('li', e)))) : null,
    h('div.coach-quote.small', coachLine),
    p.confidence === 'low' ? h('p.small.muted', 'Short game: low confidence. Your profile sharpens across games (see Your mind).') : null,
  );
}

function render(el: HTMLElement, g: StoredGame, review: GameReview, mind: MindReport): void {
  let cur = 0;
  let coachId = pref('coach', 'kiyo');
  const coach = () => COACHES.find((c) => c.id === coachId) ?? COACHES[0];
  const report = coachReport(review, mind);
  const boardEl = h('div.board');
  const evalBar = h('div.vbar', { title: 'Evaluation: White’s winning chances' }, h('div.fill'), h('div.label'));
  const frameBar = h('div.vbar.frame', { title: 'Frame: who holds the initiative (teal = White)' }, h('div.fill'));
  const board = new Board(boardEl, { orientation: g.you === 'b' ? 'black' : 'white', fen: g.plies[0].fenBefore });
  const panel = h('div');
  const movesBox = h('div');
  const graphBox = h('div');
  const coachSel = h(
    'select',
    { onchange: () => ((coachId = coachSel.value), setPref('coach', coachId), show(cur)) },
    COACHES.map((c) => h('option', { value: c.id, selected: c.id === coachId }, `${c.name} — ${c.title}`)),
  );

  const show = (ply: number) => {
    cur = Math.max(0, Math.min(g.plies.length, ply));
    const p = g.plies[cur - 1];
    board.load(p ? p.fenAfter : g.plies[0].fenBefore, p?.uci);
    const win = winBarHeight(review, cur);
    (evalBar.firstChild as HTMLElement).style.height = `${win}%`;
    (evalBar.lastChild as HTMLElement).textContent = `${Math.round(win)}`;
    const f = cur ? mind.frame[cur - 1].frame : 0.1;
    (frameBar.firstChild as HTMLElement).style.height = `${50 + 50 * f}%`;
    const r = review.plies[cur - 1];
    const read = mind.reads[cur - 1];
    const fp = mind.frame[cur - 1];
    board.shapes(r && r.bestUci && r.bestUci !== r.uci && r.epLoss > 0.02 ? [arrow(r.bestUci, 'green'), arrow(r.uci, 'red')] : []);
    clear(movesBox, moveList(g.plies.map((x) => x.san), cur, show, (i) => badge(review.plies[i].classification)));
    clear(graphBox, graph(review, mind, cur, show));
    if (!r) {
      clear(panel, h('div.card', h('h3', review.opening ? `${review.opening.eco} · ${review.opening.name}` : 'Start position'), h('p.small.muted', 'Use ← → or click moves. Teal line on the graph = frame (initiative); white area = winning chances.')));
      return;
    }
    const say = coachSay(coach(), r, read);
    clear(
      panel,
      h(
        'div.card',
        h('div.row', badge(r.classification), h('span.cls', { style: `color:${CLS[r.classification].color}` }, `${r.san} is ${CLS[r.classification].label.toLowerCase()}`), h('span.muted.small', r.epLoss > 0.005 ? `−${Math.round(r.epLoss * 100)}% winning chances` : '')),
        h('p', read.why),
        r.bestSan && r.bestUci !== r.uci ? h('div.small.muted', `Best: ${r.bestSan} — ${r.bestLineSan.join(' ')}`) : null,
        read.tags.length ? h('div.tags', { style: 'margin:8px 0' }, read.tags.map((t) => h('span.tag', { class: `lens-${t.lens}`, title: t.detail }, `${t.lens} · ${t.label}`))) : null,
        h(
          'div.small.muted',
          read.thinkRatio !== undefined ? `Think: ${((g.plies[cur - 1].thinkMs ?? 0) / 1000).toFixed(1)}s (${read.thinkRatio.toFixed(1)}× usual) · ` : '',
          `Frame: White ${fp.state.w} / Black ${fp.state.b}`,
          read.pressure ? ` · Pressure: ${read.pressureReasons.join(', ')}` : '',
          read.freeChoice ? ' · Free choice' : '',
        ),
        say ? h('div.coach-quote', { style: 'margin-top:10px' }, h('b', `${coach().name}: `), say) : null,
      ),
    );
  };

  const counts = h(
    'table.counts',
    (['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'] as const).map((c) =>
      h('tr', h('td', badge(c)), h('td', review.white.counts[c]), h('td', CLS[c].label), h('td', review.black.counts[c])),
    ),
  );

  el.append(
    h('div.row', { style: 'justify-content:space-between' }, h('h1', `${g.meta.white ?? 'White'} vs ${g.meta.black ?? 'Black'}`), h('div.row', 'Coach', coachSel)),
    h('p.muted', review.opening ? `${review.opening.eco} · ${review.opening.name} · ` : '', `${g.meta.result ?? '*'}${g.meta.termination ? ` · ${g.meta.termination}` : ''}`),
    h(
      'div.game',
      h('div', h('div.board-wrap', h('div.bars', evalBar, frameBar), boardEl), h('div', { style: 'margin-top:10px' }, graphBox)),
      h(
        'div.side-panel',
        panel,
        movesBox,
        h('div.row', h('button', { onclick: () => show(0) }, '⏮'), h('button', { onclick: () => show(cur - 1) }, '◀'), h('button', { onclick: () => show(cur + 1) }, '▶'), h('button', { onclick: () => show(g.plies.length) }, '⏭')),
        h('div.card', h('div.row', { style: 'justify-content:space-between' }, h('b', `White ${review.white.accuracy.toFixed(1)}`), h('span.muted.small', 'Accuracy'), h('b', `Black ${review.black.accuracy.toFixed(1)}`)), counts),
      ),
    ),
    h('h2', 'The story'),
    h('div.card', h('h3', report.headline), report.paragraphs.map((p) => h('p', p))),
    h('h2', 'Key moments'),
    h('div.grid', mind.keyMoments.map((k) => h('div.card.link', { onclick: () => show(k.ply) }, h('h3', k.title), h('span.pill', k.kind), h('p.small.muted', k.detail)))),
    h('h2', 'Mind Read'),
    h(
      'div.grid',
      { style: 'grid-template-columns:repeat(auto-fill,minmax(340px,1fr))' },
      profileCard(mind.white, 'White', review.white.accuracy, coachSummary(coach(), mind.white.identity)),
      profileCard(mind.black, 'Black', review.black.accuracy, coachSummary(coach(), mind.black.identity)),
    ),
    h(
      'div.grid',
      { style: 'margin-top:14px;grid-template-columns:repeat(auto-fill,minmax(340px,1fr))' },
      (['w', 'b'] as const).map((s) =>
        h(
          'div.card',
          h('h3', `${s === 'w' ? 'White' : 'Black'}: ego work`),
          h('p.small', report.forPlayer[s].identity),
          h('p.small', h('b', 'The script: '), report.forPlayer[s].script),
          h('p.small', h('b', 'The drill: '), report.forPlayer[s].prescription),
        ),
      ),
    ),
    h('p.small.muted', { style: 'margin-top:20px' }, 'Mind Read is a coaching lens built on observable choices (think time, move type, initiative, quality under pressure). It describes patterns in play, not a diagnosis of a person.'),
  );
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  };
  window.addEventListener('keydown', onKey);
  show(0);
  const prev = el.ownerDocument.defaultView;
  const stop = () => window.removeEventListener('keydown', onKey);
  prev?.addEventListener('hashchange', stop, { once: true });
}

export type { GameMeta };
