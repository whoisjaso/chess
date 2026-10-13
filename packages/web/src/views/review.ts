import {
  ARCHETYPE_INFO,
  ARCHETYPES,
  coachReport,
  coachSay,
  coachSummary,
  COACHES,
  identifyOpening,
  lineToCp,
  pliesFromPgn,
  pliesFromUci,
  puzzlesFromReview,
  readMinds,
  reviewGame,
  type Classification,
  type GameReview,
  type MindReport,
  type PlayerProfile,
  type PositionEval,
  type Puzzle,
} from '@chessbutfree/core';
import { Chess } from 'chess.js';
import { arrow, Board } from '../board';
import { avatar, boardLayout, bubble, img3d, moveTable, navButtons, panelHead, tabs, type BoardLayout } from '../components';
import { clear, h } from '../dom';
import { engine } from '../engine';
import { icon, tierColor, tierIcon, TIER_LABEL } from '../icons';
import type { View } from '../main';
import { play } from '../sound';
import { getGame, listGames, newId, pref, saveGame, setPref, type StoredGame } from '../store';
import { onSpeaking, speak, stopSpeaking } from '../voice';

/* ------------------------------------------------------------------ persistence of derived data */

const PROFILE_KEY = 'chessbutfree.profiles.v1';
const MISTAKES_KEY = 'chessbutfree.mistakePuzzles.v1';

export function storedProfiles(): Record<string, { at: number; you: 'w' | 'b'; profile: PlayerProfile; accuracy: number }> {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function mistakePuzzles(): Puzzle[] {
  try {
    return JSON.parse(localStorage.getItem(MISTAKES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function remember(g: StoredGame, review: GameReview, mind: MindReport): void {
  try {
    if (g.you) {
      const all = storedProfiles();
      all[g.id] = { at: g.at, you: g.you, profile: g.you === 'w' ? mind.white : mind.black, accuracy: g.you === 'w' ? review.white.accuracy : review.black.accuracy };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
    }
    const fresh = puzzlesFromReview(g.id, g.plies, review, g.you);
    const prev = mistakePuzzles().filter((p) => p.source?.gameId !== g.id);
    localStorage.setItem(MISTAKES_KEY, JSON.stringify([...fresh, ...prev].slice(0, 300)));
  } catch {
    /* storage unavailable */
  }
}

/* ------------------------------------------------------------------ eval helpers */

/** White-POV eval label for a position read: "1.4", "-0.3", "M3". */
function evalLabel(ev: PositionEval | null | undefined, whiteToMove: boolean): { text: string; whitePct: number } {
  const line = ev?.lines[0];
  if (!line) return { text: '0.0', whitePct: 50 };
  const sign = whiteToMove ? 1 : -1;
  if (line.mate !== undefined) {
    const m = line.mate * sign;
    return { text: `M${Math.abs(m)}`, whitePct: m > 0 ? 100 : m < 0 ? 0 : 50 };
  }
  const cp = (line.cp ?? 0) * sign;
  const pct = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * lineToCp({ ...line, cp }))) - 1);
  return { text: (Math.abs(cp) / 100).toFixed(1), whitePct: pct };
}

function evalBar(): { el: HTMLElement; set(pct: number, text: string, flipped: boolean): void } {
  const white = h('div.white');
  const num = h('div.num');
  const el = h('div.evalbar', white, num);
  return {
    el,
    set(pct, text, flipped) {
      white.style.height = `${pct}%`;
      el.classList.toggle('flip', flipped);
      num.textContent = text;
      num.className = `num ${pct >= 50 ? 'bottom' : 'top'}`;
    },
  };
}

function frameBar(): { el: HTMLElement; set(f: number, flipped: boolean): void } {
  const fill = h('div.fill');
  const el = h('div.framebar', { title: 'Frame bar: who holds the initiative (teal = White)' }, fill);
  return {
    el,
    set(f, flipped) {
      fill.style.height = `${50 + 50 * f}%`;
      el.classList.toggle('flip', flipped);
    },
  };
}

function graph(review: GameReview, mind: MindReport | null, cur: number, pick: (ply: number) => void): SVGSVGElement {
  const W = 400;
  const H = 86;
  const n = Math.max(1, review.winSeries.length - 1);
  const x = (i: number) => (i / n) * W;
  const ns = 'http://www.w3.org/2000/svg';
  const svgEl = document.createElementNS(ns, 'svg');
  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgEl.setAttribute('preserveAspectRatio', 'none');
  svgEl.classList.add('graph');
  const add = (tag: string, attrs: Record<string, string | number>) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    svgEl.append(e);
    return e;
  };
  const pts = review.winSeries.map((w, i) => `${x(i)},${H - (w / 100) * H}`).join(' L');
  add('path', { d: `M0,${H} L${pts} L${W},${H} Z`, fill: '#fff' });
  add('line', { x1: 0, x2: W, y1: H / 2, y2: H / 2, stroke: '#8b8987', 'stroke-width': 0.6, 'stroke-dasharray': '3 3' });
  if (mind) {
    const fr = [0.1, ...mind.frame.map((f) => f.frame)].map((f, i) => `${x(i)},${H / 2 - (f * H) / 2.2}`).join(' L');
    add('path', { d: `M${fr}`, stroke: '#46c2b4', 'stroke-width': 1.6, fill: 'none', opacity: 0.9 });
  }
  for (const r of review.plies) {
    if (['blunder', 'mistake', 'miss', 'brilliant', 'great'].includes(r.classification)) {
      add('circle', { cx: x(r.ply), cy: H - (review.winSeries[r.ply] / 100) * H, r: 3.4, fill: tierColor(r.classification), stroke: '#262522', 'stroke-width': 1 });
    }
  }
  add('line', { x1: x(cur), x2: x(cur), y1: 0, y2: H, stroke: '#f7c631', 'stroke-width': 1.4 });
  svgEl.addEventListener('click', (e) => {
    const rect = svgEl.getBoundingClientRect();
    pick(Math.round(((e.clientX - rect.left) / rect.width) * n));
  });
  return svgEl;
}

/* ------------------------------------------------------------------ analysis landing */

export const analysisLanding: View = (el) => {
  const L = boardLayout({ bars: true });
  el.append(L.root);
  new Board(L.boardHost, { viewOnly: true, sound: false });
  const eb = evalBar();
  eb.set(50, '0.0', false);
  L.bars.append(eb.el);
  L.top.set({ name: 'Black', avatar: avatar() });
  L.bottom.set({ name: 'White', avatar: avatar() });
  const input = h('textarea.input', { placeholder: 'Paste a PGN from ChessButFree, Chess.com or Lichess…', style: 'min-height:90px' });
  const err = h('div', { style: 'color:#ff8b7b;font-weight:700;font-size:13px' });
  const load = () => {
    try {
      const { plies, meta } = pliesFromPgn(input.value);
      if (!plies.length) throw new Error('no moves found');
      const g: StoredGame = { id: newId(), at: Date.now(), plies, meta, source: 'import' };
      saveGame(g);
      location.hash = `#/review/${g.id}`;
    } catch (e) {
      err.textContent = `Could not read that PGN (${(e as Error).message}).`;
    }
  };
  const recent = listGames().slice(0, 30);
  clear(
    L.panel,
    panelHead('Analysis', img3d('review')),
    h(
      'div.panel-body',
      input,
      err,
      h('button.btn.green.lg', { onclick: load }, 'Game Review'),
      h('a.tile', { href: '#/analysis' }, h('img', { src: img3d('review'), alt: '' }), h('span.t', 'New Analysis', h('small', 'Free board with live engine lines'))),
      h('a.tile', { href: '#/openings' }, h('img', { src: img3d('openings'), alt: '' }), h('span.t', 'Explore', h('small', 'Named openings and where the script ends'))),
      h('a.tile', { href: '#/profile' }, h('img', { src: img3d('mind'), alt: '' }), h('span.t', 'Your Mind', h('small', 'Your mask, identity and tendencies across games'))),
      recent.length ? h('div.report', h('div.section', 'Recent games')) : null,
      recent.map((g) =>
        h(
          'a.tile.plain',
          { href: `#/review/${g.id}`, style: 'font-size:14px' },
          h('span.t', `${g.meta.white ?? '?'} vs ${g.meta.black ?? '?'}`, h('small', `${g.meta.result ?? '*'} · ${g.source} · ${new Date(g.at).toLocaleDateString()}`)),
          h('span.btn.sm', 'Review'),
        ),
      ),
    ),
  );
};

/* ------------------------------------------------------------------ free analysis board */

export const freeAnalysis: View = (el) => {
  const L = boardLayout({ bars: true });
  el.append(L.root);
  const eb = evalBar();
  L.bars.append(eb.el);
  L.top.set({ name: 'Black', avatar: avatar() });
  L.bottom.set({ name: 'White', avatar: avatar() });
  const moves: string[] = [];
  let view = 0;
  const lines = h('div');
  const movesBox = h('div');
  const opening = h('div.dim', { style: 'font-weight:700' });
  let token = 0;
  const board = new Board(L.boardHost, {
    interactive: 'both',
    onMove: (uci) => {
      moves.splice(view, moves.length, uci);
      view = moves.length;
      refresh();
    },
  });
  const show = (n: number) => {
    view = Math.max(0, Math.min(moves.length, n));
    const c = new Chess();
    for (const u of moves.slice(0, view)) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
    board.load(c.fen(), moves[view - 1]);
    refresh();
  };
  const refresh = async () => {
    const fen = board.chess.fen();
    const sans = pliesFromUci(moves).map((p) => p.san);
    clear(movesBox, moveTable(sans, view, show));
    const o = identifyOpening(pliesFromUci(moves.slice(0, view)).map((p) => p.fenAfter)).opening;
    opening.textContent = o ? `${o.eco} · ${o.name}` : view ? '' : 'Starting position';
    const my = ++token;
    clear(lines, h('div.dim', 'Stockfish 17.1 thinking…'));
    const ev = await engine().analyse(fen, { depth: 14, multipv: 3 });
    if (my !== token) return;
    const wtm = fen.split(' ')[1] === 'w';
    const lbl = evalLabel(ev, wtm);
    eb.set(lbl.whitePct, lbl.text, board.cg.state.orientation === 'black');
    clear(
      lines,
      ev.lines.map((l) => {
        const e = evalLabel({ ...ev, lines: [l] }, wtm);
        const san = pliesFromUci(l.pv.slice(0, 8), fen).map((p) => p.san);
        return h(
          'div.tile.plain',
          { style: 'font-size:13.5px;font-weight:700;padding:8px 10px;cursor:pointer', onclick: () => board.apply(l.move) && (moves.splice(view, moves.length, l.move), (view = moves.length), refresh()) },
          h('span.acc-box', { class: e.whitePct >= 50 ? 'w' : 'b', style: 'width:52px;font-size:13px;padding:3px 0;margin:0' }, `${e.whitePct >= 50 ? '+' : '-'}${e.text}`),
          h('span.t', { style: 'font-size:13.5px' }, san.join(' ')),
        );
      }),
    );
  };
  clear(
    L.panel,
    panelHead('Analysis', img3d('review')),
    h('div.panel-body', opening, lines, movesBox),
    h(
      'div.panel-foot',
      h(
        'button.btn.green',
        {
          onclick: () => {
            if (moves.length < 2) return;
            const g: StoredGame = { id: newId(), at: Date.now(), plies: pliesFromUci(moves), meta: { white: 'White', black: 'Black' }, source: 'import' };
            saveGame(g);
            location.hash = `#/review/${g.id}`;
          },
        },
        'Review this line',
      ),
      navButtons((w) => show(w === 'first' ? 0 : w === 'prev' ? view - 1 : w === 'next' ? view + 1 : moves.length), h('button.btn.sm', { onclick: () => (board.flip(), refresh()) }, icon('flip'))),
    ),
  );
  refresh();
};

/* ------------------------------------------------------------------ game review */

export const reviewView: View = (el, [id]) => {
  const g = getGame(id);
  if (!g) {
    el.append(h('div.page', h('h1', 'Game not found'), h('a.btn.green', { href: '#/review' }, 'Analysis')));
    return;
  }
  const L = boardLayout({ bars: true });
  el.append(L.root);
  const board = new Board(L.boardHost, { orientation: g.you === 'b' ? 'black' : 'white', fen: g.plies[0].fenBefore, sound: false });
  const eb = evalBar();
  const fb = frameBar();
  L.bars.append(eb.el, fb.el);
  const flipped = () => board.cg.state.orientation === 'black';
  const bottomSide = () => (flipped() ? 'b' : 'w');
  const setBars = () => {
    const w = { name: g.meta.white ?? 'White', rating: g.meta.whiteRating, avatar: avatarFor(g, 'w') };
    const b = { name: g.meta.black ?? 'Black', rating: g.meta.blackRating, avatar: avatarFor(g, 'b') };
    L.bottom.set(bottomSide() === 'w' ? w : b);
    L.top.set(bottomSide() === 'w' ? b : w);
  };
  setBars();
  eb.set(50, '0.0', flipped());
  fb.set(0.1, flipped());

  let cancelled = false;
  const coach = () => COACHES.find((c) => c.id === pref('coach', 'kiyo')) ?? COACHES[0];
  const bar = h('div');
  clear(
    L.panel,
    panelHead('Game Review', img3d('review')),
    h(
      'div.panel-body',
      bubble(avatar(coach().id), h('div.head', 'Let me look at this game…'), 'Stockfish 17.1 is analysing every move on your device. Then I’ll read the minds behind them.'),
      h('div.progress', bar),
    ),
  );

  const depth = pref('reviewDepth', 12);
  const cacheKey = `chessbutfree.evals.${g.id}.${depth}`;
  let cached: (PositionEval | null)[] | null = null;
  try {
    cached = JSON.parse(sessionStorage.getItem(cacheKey) ?? 'null');
  } catch {
    cached = null;
  }
  const run = async (): Promise<(PositionEval | null)[]> => {
    if (cached && cached.length === g.plies.length + 1) return cached;
    const fens = [g.plies[0].fenBefore, ...g.plies.map((p) => p.fenAfter)];
    const out: PositionEval[] = [];
    for (let i = 0; i < fens.length && !cancelled; i++) {
      out.push(await engine().analyse(fens[i], { depth, multipv: 2 }));
      bar.style.width = `${(100 * (i + 1)) / fens.length}%`;
    }
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(out));
    } catch {
      /* ignore */
    }
    return out;
  };
  run().then((evals) => {
    if (cancelled) return;
    const review = reviewGame(g.plies, evals, g.meta);
    const mind = readMinds(review, g.plies, g.meta);
    remember(g, review, mind);
    play('notify');
    reviewUI(L, board, g, review, mind, evals, eb, fb, setBars);
  });
  return () => {
    cancelled = true;
  };
};

function avatarFor(g: StoredGame, side: 'w' | 'b'): string {
  if (g.source === 'bot' && g.you && g.you !== side) {
    const name = side === 'w' ? g.meta.white : g.meta.black;
    const id = ['showman', 'diplomat', 'bookworm', 'professor', 'underdog', 'warlord', 'kiyo', 'lumen', 'karasu', 'tenka', 'flint', 'shuji', 'namenlos'].find((x) =>
      name?.toLowerCase().replace(/[^a-z]/g, '').includes(x),
    );
    return avatar(id);
  }
  return avatar();
}

const TIERS: Classification[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];

function reviewUI(
  L: BoardLayout,
  board: Board,
  g: StoredGame,
  review: GameReview,
  mind: MindReport,
  evals: (PositionEval | null)[],
  eb: ReturnType<typeof evalBar>,
  fb: ReturnType<typeof frameBar>,
  setBars: () => void,
): void {
  let tab: 'report' | 'review' | 'mind' = 'report';
  let cur = 0;
  let retry: { ply: number; result?: 'ok' | 'bad' } | null = null;
  let showBest = false;
  const coach = () => COACHES.find((c) => c.id === pref('coach', 'kiyo')) ?? COACHES[0];
  const report = coachReport(review, mind);

  board.setOnMove((uci) => {
    if (!retry) return;
    const r = review.plies[retry.ply - 1];
    const ok = uci.slice(0, 4) === r.bestUci?.slice(0, 4);
    retry.result = ok ? 'ok' : 'bad';
    play(ok ? 'correct' : 'wrong');
    board.setInteractive(undefined);
    render();
  });

  const show = (ply: number) => {
    cur = Math.max(0, Math.min(g.plies.length, ply));
    retry = null;
    showBest = false;
    paintBoard();
    render();
    narrate();
  };

  // The coach reads each move aloud in their own voice.
  let narrateTimer = 0;
  const narrate = () => {
    clearTimeout(narrateTimer);
    if (tab !== 'review') return;
    const r = review.plies[cur - 1];
    const read = mind.reads[cur - 1];
    if (!r) return stopSpeaking();
    narrateTimer = window.setTimeout(() => {
      const label = r.classification === 'book' ? 'a book move' : r.classification === 'forced' ? 'forced' : TIER_LABEL[r.classification].toLowerCase();
      const why = read.why.replace(/^[^.!?]*[.!?]\s*/, '');
      const line = coachSay(coach(), r, read);
      speak(coach().id, `${r.san.replace(/[+#]/g, '')} is ${label}. ${line ?? why}`);
    }, 250);
  };
  const offSpeak = onSpeaking((who) => L.panel.querySelectorAll('.bubble .ava').forEach((a) => a.classList.toggle('speaking', who === coach().id)));
  window.addEventListener('hashchange', () => (offSpeak(), stopSpeaking()), { once: true });

  const paintBoard = () => {
    const p = g.plies[cur - 1];
    const r = review.plies[cur - 1];
    if (retry) {
      board.load(g.plies[retry.ply - 1].fenBefore, g.plies[retry.ply - 2]?.uci);
      board.badge(null);
      board.shapes([]);
      board.setInteractive(retry.result ? undefined : g.plies[retry.ply - 1].side === 'w' ? 'white' : 'black');
      if (retry.result === 'bad' && review.plies[retry.ply - 1].bestUci) board.shapes([arrow(review.plies[retry.ply - 1].bestUci!, 'green')]);
      return;
    }
    board.setInteractive(undefined);
    board.load(p ? p.fenAfter : g.plies[0].fenBefore, p?.uci);
    board.badge(p ? p.uci.slice(2, 4) : null, r?.classification);
    const shapes = [];
    if (r && r.bestUci && r.bestUci !== r.uci && (showBest || r.epLoss >= 0.05)) shapes.push(arrow(r.bestUci, 'green'));
    if (showBest && r?.bestUci) {
      board.load(p.fenBefore, g.plies[cur - 2]?.uci);
      board.badge(null);
    }
    board.shapes(shapes);
    const lbl = evalLabel(evals[cur], cur % 2 === 0);
    eb.set(review.winSeries[cur] ?? lbl.whitePct, lbl.text, board.cg.state.orientation === 'black');
    fb.set(cur ? mind.frame[cur - 1].frame : 0.1, board.cg.state.orientation === 'black');
    L.bottom.captured(p ? p.fenAfter : g.plies[0].fenBefore, board.cg.state.orientation === 'black' ? 'b' : 'w');
    L.top.captured(p ? p.fenAfter : g.plies[0].fenBefore, board.cg.state.orientation === 'black' ? 'w' : 'b');
  };

  const render = () => {
    const head = tabs(
      [
        { id: 'report', label: 'Report', icon: 'star' },
        { id: 'review', label: 'Review', icon: 'list' },
        { id: 'mind', label: 'Mind', icon: 'players' },
      ],
      tab,
      (t) => ((tab = t), t === 'review' && cur === 0 ? show(1) : render()),
    );
    if (tab === 'report') clear(L.panel, head, h('div.panel-body', reportBody()), h('div.panel-foot', h('button.btn.green.xl', { onclick: () => ((tab = 'review'), show(cur || 1)) }, 'Start Review')));
    else if (tab === 'review') clear(L.panel, head, h('div.panel-body', reviewBody()), h('div.panel-foot', navButtons((w) => show(w === 'first' ? 0 : w === 'prev' ? cur - 1 : w === 'next' ? cur + 1 : g.plies.length), h('button.btn.sm', { title: 'Flip', onclick: () => (board.flip(), setBars(), paintBoard()) }, icon('flip')))));
    else clear(L.panel, head, h('div.panel-body', mindBody()));
  };

  /* ---------------- Report tab (Chess.com Game Review summary + Mind rows) */
  const reportBody = (): (Node | null)[] => {
    const you = g.you ?? 'w';
    const youP = you === 'w' ? mind.white : mind.black;
    const pRow = (label: string, w: Node | string, ic: Node | string, b: Node | string) => h('div.rrow', h('span.label', label), h('span.v', w), h('span.ic', ic), h('span.v', b));
    const ph = (p: 'opening' | 'middlegame' | 'endgame', label: string) => {
      const x = review.phases[p];
      return x ? pRow(label, x.w ? tierIcon(x.w) : '', '', x.b ? tierIcon(x.b) : '') : null;
    };
    return [
      bubble(avatar(coach().id), h('div.head', report.headline), coachSummary(coach(), youP.identity)),
      graph(review, mind, cur, (p) => ((tab = 'review'), show(p))),
      h(
        'div.report',
        h(
          'div.rrow.players',
          h('span.label', 'Players'),
          h('div', h('img', { src: avatarFor(g, 'w'), alt: '' }), h('div.pname', g.meta.white ?? 'White')),
          h('span'),
          h('div', h('img', { src: avatarFor(g, 'b'), alt: '' }), h('div.pname', g.meta.black ?? 'Black')),
        ),
        pRow('Accuracy', h('div.acc-box.w', review.white.accuracy.toFixed(1)), '', h('div.acc-box.b', review.black.accuracy.toFixed(1))),
        h('div.divider'),
        TIERS.map((c) =>
          h('div.rrow', h('span.label', { style: `color:${tierColor(c)}` }, TIER_LABEL[c]), h('span.v', { style: `color:${tierColor(c)}` }, review.white.counts[c]), h('span.ic', tierIcon(c)), h('span.v', { style: `color:${tierColor(c)}` }, review.black.counts[c])),
        ),
        h('div.divider'),
        h('div.section', 'Mind Read'),
        pRow('Mask', short(mind.white), '', short(mind.black)),
        pRow('Identity', String(mind.white.identity ?? '—'), '', String(mind.black.identity ?? '—')),
        pRow('Initiative', `${Math.round(100 * mind.white.initiativeShare)}%`, '', `${Math.round(100 * mind.black.initiativeShare)}%`),
        pRow('Impulse / Tilt', `${mind.white.impulseErrors} / ${mind.white.tiltEvents}`, '', `${mind.black.impulseErrors} / ${mind.black.tiltEvents}`),
        h('div.divider'),
        ph('opening', 'Opening'),
        ph('middlegame', 'Middlegame'),
        ph('endgame', 'Endgame'),
      ),
      review.opening ? h('div.dim', { style: 'font-size:13px;font-weight:700;text-align:center' }, `${review.opening.eco} · ${review.opening.name}`) : null,
    ];
  };

  /* ---------------- Review tab (move by move with the coach) */
  const reviewBody = (): (Node | null)[] => {
    const r = review.plies[cur - 1];
    const read = mind.reads[cur - 1];
    if (!r) {
      return [bubble(avatar(coach().id), h('div.head', review.opening ? review.opening.name : 'Starting position'), 'Step through the game. I’ll grade every move and tell you what was going on in the player’s head.'), moveTable(g.plies.map((p) => p.san), cur, show, (i) => review.plies[i].classification)];
    }
    const color = tierColor(r.classification);
    const title = `${r.san} is ${r.classification === 'book' ? 'a book move' : r.classification === 'forced' ? 'forced' : TIER_LABEL[r.classification].toLowerCase()}`;
    const say = coachSay(coach(), r, read);
    const retryable = (r.classification === 'mistake' || r.classification === 'blunder' || r.classification === 'miss' || r.classification === 'inaccuracy') && r.bestUci;
    const retryBox = retry
      ? retry.result === 'ok'
        ? h('div.banner.ok', icon('check'), `Correct! ${r.bestSan} was the move.`)
        : retry.result === 'bad'
          ? h('div.banner.bad', icon('x'), `Not quite — ${r.bestSan} was best.`)
          : h('div.banner.info', icon('retry'), `Find a better move for ${r.side === 'w' ? 'White' : 'Black'}.`)
      : null;
    return [
      bubble(
        avatar(coach().id),
        h('div.head', { style: `color:${color}` }, tierIcon(r.classification), title),
        read.why.replace(/^[^.!?]*[.!?]\s*/, ''),
        r.bestSan && r.bestUci !== r.uci && r.epLoss > 0.02 ? h('div', { style: 'margin-top:4px;color:#5d5a57;font-size:13.5px' }, h('b', 'Best: '), `${r.bestSan}  `, h('span', { style: 'opacity:.8' }, r.bestLineSan.slice(1, 5).join(' '))) : null,
        say ? h('div.quote', `${coach().name}: “${say}”`) : null,
      ),
      read.tags.length ? h('div.tags', read.tags.map((t) => h('span.tag', { class: `lens-${t.lens}`, title: t.detail }, t.label))) : null,
      h(
        'div.dim',
        { style: 'font-size:12.5px;font-weight:700' },
        read.thinkRatio !== undefined ? `⏱ ${((g.plies[cur - 1].thinkMs ?? 0) / 1000).toFixed(1)}s (${read.thinkRatio.toFixed(1)}× usual)` : '',
        read.pressure ? ` · Under pressure: ${read.pressureReasons.join(', ')}` : '',
        read.freeChoice ? ' · Free choice' : '',
      ),
      retryBox,
      h(
        'div',
        { style: 'display:flex;gap:8px' },
        h('button.btn.sm', { style: 'flex:1', onclick: () => ((showBest = !showBest), (retry = null), paintBoard(), render()) }, icon('star'), 'Best'),
        retryable ? h('button.btn.sm', { style: 'flex:1', onclick: () => ((retry = { ply: cur }), paintBoard(), render()) }, icon('retry'), 'Retry') : null,
        h('button.btn.green.sm', { style: 'flex:1', onclick: () => show(cur + 1) }, 'Next', icon('chevronRight')),
      ),
      graph(review, mind, cur, show),
      moveTable(g.plies.map((p) => p.san), cur, show, (i) => review.plies[i].classification),
    ];
  };

  /* ---------------- Mind tab */
  const mindBody = (): (Node | null)[] => {
    const card = (p: PlayerProfile, label: string) =>
      h(
        'div.card',
        { style: 'background:#2f2d2a;padding:14px' },
        h('h3', `${label}: ${ARCHETYPE_INFO[p.mask[0]].title} + ${ARCHETYPE_INFO[p.mask[1]].title}`),
        ARCHETYPES.map((a) => h('div.arch', h('span', ARCHETYPE_INFO[a].title), h('div.meter', h('div', { style: `width:${Math.round(100 * p.archetypes[a])}%` })), h('span.dim', `${Math.round(100 * p.archetypes[a])}%`))),
        h('p.muted', { style: 'font-size:13.5px;margin:8px 0 0' }, ARCHETYPE_INFO[p.mask[0]].board, ' ', h('i', ARCHETYPE_INFO[p.mask[0]].inverse)),
        h('p', { style: 'font-size:13.5px;margin:8px 0 0' }, h('b', 'Identity: '), report.forPlayer[p.side].identity),
        h('p', { style: 'font-size:13.5px;margin:6px 0 0' }, h('b', 'Script: '), report.forPlayer[p.side].script),
        h('p', { style: 'font-size:13.5px;margin:6px 0 0' }, h('b', 'Drill: '), report.forPlayer[p.side].prescription),
      );
    return [
      h('div.report', h('div.section', 'The story')),
      ...report.paragraphs.map((p) => h('p', { style: 'margin:0;font-size:14px' }, p)),
      h('div.report', h('div.section', 'Key moments')),
      ...mind.keyMoments.map((k) => h('div.tile.plain', { style: 'font-size:14px;padding:10px', onclick: () => ((tab = 'review'), show(k.ply)) }, h('span.t', k.title, h('small', k.detail)))),
      card(mind.white, 'White'),
      card(mind.black, 'Black'),
      h('div.opt-row', 'Review coach', h('select.input', { style: 'width:auto', onchange: (e: Event) => (setPref('coach', (e.target as HTMLSelectElement).value), render()) }, COACHES.map((c) => h('option', { value: c.id, selected: c.id === coach().id }, `${c.name} — ${c.title}`)))),
      h('p.dim', { style: 'font-size:12px;margin:0' }, 'Mind Read is a coaching lens on observable choices — not a psychological diagnosis.'),
    ];
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') ((tab = tab === 'report' ? 'review' : tab), show(cur - 1));
    if (e.key === 'ArrowRight') ((tab = tab === 'report' ? 'review' : tab), show(cur + 1));
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => window.removeEventListener('keydown', onKey), { once: true });
  paintBoard();
  render();
  speak(coach().id, `${report.headline} ${coachSummary(coach(), (g.you === 'b' ? mind.black : mind.white).identity)}`);
}

function short(p: PlayerProfile): HTMLElement {
  return h('span', { style: 'font-size:11.5px;line-height:1.1;display:block' }, `${ARCHETYPE_INFO[p.mask[0]].title}`, h('br'), h('span.dim', ARCHETYPE_INFO[p.mask[1]].title));
}
