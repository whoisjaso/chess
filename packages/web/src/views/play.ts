import { BOT_LEVELS, BOTS, chooseBotMove, COACHES, type GameMeta, type PlyRecord, type ServerMsg, type TimeControl, type WireGame } from '@mindboard/core';
import { Chess } from 'chess.js';
import { Board, type Color, type MoveMeta } from '../board';
import { clear, fmtClock, h } from '../dom';
import { engine } from '../engine';
import type { View } from '../main';
import { net } from '../net';
import { newId, pref, saveGame, setPref } from '../store';
import { moveList } from '../ui';

const TCS: [string, TimeControl][] = [
  ['1+0', { initialMs: 60_000, incrementMs: 0 }],
  ['2+1', { initialMs: 120_000, incrementMs: 1000 }],
  ['3+0', { initialMs: 180_000, incrementMs: 0 }],
  ['3+2', { initialMs: 180_000, incrementMs: 2000 }],
  ['5+0', { initialMs: 300_000, incrementMs: 0 }],
  ['10+0', { initialMs: 600_000, incrementMs: 0 }],
  ['15+10', { initialMs: 900_000, incrementMs: 10_000 }],
  ['30+0', { initialMs: 1_800_000, incrementMs: 0 }],
];

const tcLabel = (tc: TimeControl) => `${tc.initialMs / 60000}+${tc.incrementMs / 1000}`;

export const playView: View = (el, [mode, gameId], query) => {
  if (mode === 'bot' && query.get('bot')) return botGame(el, query);
  if (mode === 'local' && query.get('go')) return localGame(el, query);
  if (mode === 'online' && gameId) return onlineGame(el, gameId);
  if (mode === 'online') return onlineLobby(el);
  return setup(el, mode ?? 'bot');
};

function setup(el: HTMLElement, mode: string): void {
  el.append(
    h('h1', 'Play'),
    h(
      'div.tabs',
      [
        ['bot', 'Computer'],
        ['online', 'Online'],
        ['local', 'Pass & play'],
      ].map(([m, label]) => h('button', { class: m === mode ? 'on' : '', onclick: () => (location.hash = `#/play/${m}`) }, label)),
    ),
  );
  if (mode === 'local') {
    const tc = h('select', TCS.map(([l]) => h('option', { value: l }, l)), h('option', { value: 'none', selected: true }, 'Untimed'));
    el.append(h('div.card', h('p', 'Two players, one device. Think times are still recorded, so Review can read both minds.'), h('div.row', 'Time control', tc, h('button.primary', { onclick: () => (location.hash = `#/play/local?go=1&tc=${tc.value}`) }, 'Start'))));
    return;
  }
  // Computer
  let bot = pref('bot', 'professor');
  let level = pref('level', 3);
  const botGrid = h('div.grid');
  const renderBots = () =>
    clear(
      botGrid,
      BOTS.map((b) => {
        const coach = COACHES.find((c) => c.sparsAs === b.id);
        return h(
          'div.card.link',
          { style: b.id === bot ? 'border-color:var(--accent)' : '', onclick: () => ((bot = b.id), setPref('bot', bot), renderBots()) },
          h('h3', b.name),
          h('span.pill', b.archetype),
          h('p.muted.small', b.blurb),
          coach ? h('div.small.muted', `Coach sparring partner: ${coach.name}`) : null,
        );
      }),
    );
  renderBots();
  const lvl = h('select', { onchange: () => setPref('level', Number(lvl.value)) }, BOT_LEVELS.map((l) => h('option', { value: l.id, selected: l.id === level }, l.label)));
  const color = h('select', h('option', { value: 'w' }, 'White'), h('option', { value: 'b' }, 'Black'), h('option', { value: 'r' }, 'Random'));
  const tc = h('select', h('option', { value: 'none' }, 'Untimed'), TCS.map(([l]) => h('option', { value: l }, l)));
  el.append(
    botGrid,
    h(
      'div.row',
      { style: 'margin-top:16px' },
      'Strength',
      lvl,
      'Play as',
      color,
      'Clock',
      tc,
      h(
        'button.primary',
        {
          onclick: () => {
            level = Number(lvl.value);
            const c = color.value === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : color.value;
            location.hash = `#/play/bot?bot=${bot}&level=${level}&color=${c}&tc=${tc.value}`;
          },
        },
        'Play',
      ),
    ),
  );
}

/** Shared game screen used by bot, local and online play. */
interface Screen {
  board: Board;
  status: HTMLElement;
  actions: HTMLElement;
  top: { name: HTMLElement; clock: HTMLElement };
  bottom: { name: HTMLElement; clock: HTMLElement };
  movesBox: HTMLElement;
}

function screen(el: HTMLElement, orientation: Color, onMove: (uci: string, meta: MoveMeta) => void): Screen {
  const boardEl = h('div.board');
  const mk = () => ({ name: h('div'), clock: h('div.clock', '–') });
  const top = mk();
  const bottom = mk();
  const status = h('div.status', 'White to move');
  const actions = h('div.row');
  const movesBox = h('div');
  el.append(
    h(
      'div.game',
      h('div', h('div.player', top.name, top.clock), h('div', { style: 'height:8px' }), boardEl, h('div', { style: 'height:8px' }), h('div.player', bottom.name, bottom.clock)),
      h('div.side-panel', status, movesBox, actions),
    ),
  );
  const board = new Board(boardEl, { orientation, onMove });
  return { board, status, actions, top, bottom, movesBox };
}

function renderMoves(s: Screen): void {
  clear(s.movesBox, moveList(s.board.chess.history(), s.board.chess.history().length, () => {}));
}

function resultOf(chess: Chess): { result: GameMeta['result']; termination: string } | null {
  if (chess.isCheckmate()) return { result: chess.turn() === 'w' ? '0-1' : '1-0', termination: 'checkmate' };
  if (chess.isStalemate()) return { result: '1/2-1/2', termination: 'stalemate' };
  if (chess.isThreefoldRepetition()) return { result: '1/2-1/2', termination: 'threefold repetition' };
  if (chess.isInsufficientMaterial()) return { result: '1/2-1/2', termination: 'insufficient material' };
  if (chess.isDraw()) return { result: '1/2-1/2', termination: 'fifty-move rule' };
  return null;
}

/** Local clocks for bot and pass-and-play games. */
function localClock(tcParam: string | null, onFlag: (side: 'w' | 'b') => void) {
  const tc = TCS.find(([l]) => l === tcParam)?.[1];
  const clocks = { w: tc?.initialMs ?? 0, b: tc?.initialMs ?? 0 };
  let turn: 'w' | 'b' = 'w';
  let started = 0;
  let moves = 0;
  let timer = 0;
  const live = () => {
    const c = { ...clocks };
    if (tc && moves >= 2 && started) c[turn] -= performance.now() - started;
    return c;
  };
  return {
    tc,
    live,
    /** Record a move by `side`; returns that side's remaining clock. */
    moved(side: 'w' | 'b', thinkMs: number): number {
      if (tc && moves >= 2) clocks[side] = clocks[side] - thinkMs + tc.incrementMs;
      moves++;
      turn = side === 'w' ? 'b' : 'w';
      started = performance.now();
      return clocks[side];
    },
    start(tick: () => void) {
      started = performance.now();
      timer = window.setInterval(() => {
        tick();
        const c = live();
        if (tc && moves >= 2 && c[turn] <= 0) onFlag(turn);
      }, 100);
    },
    stop: () => clearInterval(timer),
  };
}

function finishLocal(s: Screen, plies: PlyRecord[], meta: GameMeta, source: 'bot' | 'local', you: 'w' | 'b' | undefined, opponent?: string): void {
  const id = newId();
  saveGame({ id, at: Date.now(), plies, meta, you, source, opponent });
  s.board.setInteractive(undefined);
  s.status.textContent = `${meta.result} · ${meta.termination}`;
  clear(
    s.actions,
    h('button.primary', { onclick: () => (location.hash = `#/review/${id}`) }, 'Review with Mind Read'),
    h('button', { onclick: () => location.reload() }, 'Rematch'),
    h('button', { onclick: () => (location.hash = '#/play') }, 'New game'),
  );
}

function botGame(el: HTMLElement, q: URLSearchParams): () => void {
  const persona = BOTS.find((b) => b.id === q.get('bot')) ?? BOTS[0];
  const level = BOT_LEVELS.find((l) => l.id === Number(q.get('level'))) ?? BOT_LEVELS[2];
  const you: 'w' | 'b' = q.get('color') === 'b' ? 'b' : 'w';
  const plies: PlyRecord[] = [];
  let over = false;
  const meta: GameMeta = { white: you === 'w' ? 'You' : persona.name, black: you === 'b' ? 'You' : persona.name };
  const clock = localClock(q.get('tc'), (side) => end(side === 'w' ? '0-1' : '1-0', 'time'));
  meta.initialMs = clock.tc?.initialMs;
  meta.incrementMs = clock.tc?.incrementMs;

  const record = (uci: string, thinkMs: number, considered?: string[]) => {
    const before = plies.length ? plies[plies.length - 1].fenAfter : new Chess().fen();
    const c = new Chess(before);
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
    const clockMs = clock.moved(m.color, thinkMs);
    plies.push({ ply: plies.length + 1, side: m.color, san: m.san, uci, fenBefore: before, fenAfter: c.fen(), thinkMs, clockMs: clock.tc ? clockMs : undefined, considered });
  };
  const end = (result: GameMeta['result'], termination: string) => {
    if (over) return;
    over = true;
    clock.stop();
    meta.result = result;
    meta.termination = termination;
    finishLocal(s, plies, meta, 'bot', you, persona.name);
  };
  const afterMove = () => {
    renderMoves(s);
    const r = resultOf(s.board.chess);
    if (r) return end(r.result, r.termination);
    s.status.textContent = s.board.chess.turn() === you ? 'Your move' : `${persona.name} is thinking…`;
    if (s.board.chess.turn() !== you) botMove();
  };
  const botMove = async () => {
    const t0 = performance.now();
    const fen = s.board.chess.fen();
    const ev = await engine().analyse(fen, { depth: level.depth, multipv: 5 });
    if (over || s.board.chess.fen() !== fen) return;
    const uci = chooseBotMove(fen, ev.lines, persona, level);
    const minDelay = 300 + Math.random() * 900;
    const wait = Math.max(0, minDelay - (performance.now() - t0));
    setTimeout(() => {
      if (over) return;
      s.board.apply(uci);
      record(uci, Math.round(performance.now() - t0));
      afterMove();
    }, wait);
  };

  const s = screen(el, you === 'w' ? 'white' : 'black', (uci, m) => {
    record(uci, m.thinkMs, m.considered);
    afterMove();
  });
  s.top.name.append(h('b', persona.name), h('span.muted.small', ` · ${persona.archetype} · ${level.label}`));
  s.bottom.name.append(h('b', 'You'));
  s.board.setInteractive(you === 'w' ? 'white' : 'black');
  const paint = () => {
    const c = clock.live();
    const theirs = you === 'w' ? 'b' : 'w';
    for (const [box, side] of [[s.bottom.clock, you], [s.top.clock, theirs]] as const) {
      box.textContent = clock.tc ? fmtClock(c[side]) : '∞';
      box.className = `clock${s.board.chess.turn() === side && !over ? ' running' : ''}${clock.tc && c[side] < 20_000 ? ' low' : ''}`;
    }
  };
  clock.start(paint);
  s.actions.append(h('button', { onclick: () => end(you === 'w' ? '0-1' : '1-0', 'resignation') }, 'Resign'));
  afterMove();
  return () => {
    over = true;
    clock.stop();
  };
}

function localGame(el: HTMLElement, q: URLSearchParams): () => void {
  const plies: PlyRecord[] = [];
  let over = false;
  const meta: GameMeta = { white: 'White', black: 'Black' };
  const clock = localClock(q.get('tc'), (side) => end(side === 'w' ? '0-1' : '1-0', 'time'));
  meta.initialMs = clock.tc?.initialMs;
  meta.incrementMs = clock.tc?.incrementMs;
  const end = (result: GameMeta['result'], termination: string) => {
    if (over) return;
    over = true;
    clock.stop();
    Object.assign(meta, { result, termination });
    finishLocal(s, plies, meta, 'local', undefined);
  };
  const s = screen(el, 'white', (uci, m) => {
    const last = plies[plies.length - 1];
    const before = last ? last.fenAfter : new Chess().fen();
    const side = s.board.chess.turn() === 'w' ? 'b' : 'w';
    const clockMs = clock.moved(side, m.thinkMs);
    plies.push({ ply: plies.length + 1, side, san: s.board.chess.history().slice(-1)[0], uci, fenBefore: before, fenAfter: s.board.chess.fen(), thinkMs: m.thinkMs, clockMs: clock.tc ? clockMs : undefined, considered: m.considered });
    renderMoves(s);
    const r = resultOf(s.board.chess);
    if (r) end(r.result, r.termination);
    else s.status.textContent = `${s.board.chess.turn() === 'w' ? 'White' : 'Black'} to move`;
  });
  s.board.setInteractive('both');
  s.top.name.append(h('b', 'Black'));
  s.bottom.name.append(h('b', 'White'));
  clock.start(() => {
    const c = clock.live();
    s.bottom.clock.textContent = clock.tc ? fmtClock(c.w) : '∞';
    s.top.clock.textContent = clock.tc ? fmtClock(c.b) : '∞';
  });
  s.actions.append(h('button', { onclick: () => end(s.board.chess.turn() === 'w' ? '0-1' : '1-0', 'resignation') }, 'Resign (side to move)'));
  return () => clock.stop();
}

// ------------------------------------------------------------------------------------ online

function onlineLobby(el: HTMLElement): () => void {
  const info = h('div.muted.small', 'Connecting…');
  const seeking = h('div');
  const nameInput = h('input', { value: net.name, placeholder: 'Display name', maxLength: 24 });
  let rated = true;
  const ratedBox = h('input', { type: 'checkbox', checked: true, onchange: () => (rated = ratedBox.checked) });
  el.append(
    h('h1', 'Play online'),
    h('div.row', nameInput, h('button', { onclick: () => (setPref('name', nameInput.value), (net.name = nameInput.value), location.reload()) }, 'Save name'), h('label.row', ratedBox, 'Rated')),
    h('h2', 'Quick pairing'),
    h(
      'div.grid',
      TCS.map(([label, tc]) => h('div.card.link', { style: 'text-align:center', onclick: () => net.send({ t: 'seek', tc, rated }) }, h('h3', label), h('div.muted.small', label.startsWith('1') || label.startsWith('2') ? 'Bullet' : label.startsWith('3') || label.startsWith('5') ? 'Blitz' : 'Rapid'))),
    ),
    seeking,
    h('h2', 'Challenge a friend'),
    h('div.row', ...TCS.slice(3, 7).map(([label, tc]) => h('button', { onclick: () => net.send({ t: 'createPrivate', tc }) }, `Create ${label} link`))),
    h('h2', 'Status'),
    info,
  );
  const off = net.on((m: ServerMsg) => {
    if (m.t === 'welcome') info.textContent = `Connected as ${m.name} · blitz ${m.ratings.blitz} · rapid ${m.ratings.rapid} · bullet ${m.ratings.bullet}`;
    if (m.t === 'lobby') info.textContent = `${info.textContent?.split(' · online')[0]} · online ${m.online}`;
    if (m.t === 'seeking') clear(seeking, h('div.status', `Seeking ${tcLabel(m.tc)}… `, h('button.ghost', { onclick: () => (net.send({ t: 'cancelSeek' }), clear(seeking)) }, 'Cancel')));
    if (m.t === 'privateCreated') {
      const link = `${location.origin}${location.pathname}#/play/online/${m.gameId}`;
      clear(seeking, h('div.status', 'Send this link to your friend: ', h('input', { value: link, style: 'width:100%', onclick: (e: Event) => (e.target as HTMLInputElement).select() }), h('div.small.muted', 'Waiting for them to join…')));
      void navigator.clipboard?.writeText(link).catch(() => {});
    }
    if (m.t === 'game') location.hash = `#/play/online/${m.game.id}`;
  });
  return () => off();
}

function onlineGame(el: HTMLElement, gameId: string): () => void {
  let game: WireGame | null = null;
  let you: 'w' | 'b' | undefined;
  let s: Screen | null = null;
  const timer = window.setInterval(() => paint(), 100);
  let lastTick = performance.now();
  const considered: Record<number, string[]> = {};

  const paint = () => {
    if (!s || !game) return;
    const now = performance.now();
    const c = { ...game.clocks };
    if (game.status === 'playing' && game.moves.length >= 2) c[game.turn] -= now - lastTick;
    const bottomSide = you ?? 'w';
    const topSide = bottomSide === 'w' ? 'b' : 'w';
    for (const [box, side] of [[s.bottom.clock, bottomSide], [s.top.clock, topSide]] as const) {
      box.textContent = fmtClock(c[side]);
      box.className = `clock${game.turn === side && game.status === 'playing' ? ' running' : ''}${c[side] < 20_000 ? ' low' : ''}`;
    }
  };

  const build = (g: WireGame) => {
    clear(el);
    s = screen(el, you === 'b' ? 'black' : 'white', (uci, m) => {
      considered[g.moves.length + 1] = m.considered;
      net.send({ t: 'move', gameId, uci, thinkMs: m.thinkMs });
    });
    for (const mv of g.moves) s.board.apply(mv.uci);
    const bottom = you === 'b' ? g.black : g.white;
    const top = you === 'b' ? g.white : g.black;
    s.bottom.name.append(h('b', bottom.name), h('span.muted.small', ` ${bottom.rating}${bottom.provisional ? '?' : ''}`));
    s.top.name.append(h('b', top.name), h('span.muted.small', ` ${top.rating}${top.provisional ? '?' : ''}`));
    s.board.setInteractive(you && g.status === 'playing' ? (you === 'w' ? 'white' : 'black') : undefined);
    renderMoves(s);
    statusLine();
    if (you && g.status === 'playing') {
      clear(
        s.actions,
        h('button', { onclick: () => net.send({ t: 'abort', gameId }) }, 'Abort'),
        h('button', { onclick: () => net.send({ t: 'offerDraw', gameId }) }, 'Offer draw'),
        h('button', { onclick: () => confirm('Resign?') && net.send({ t: 'resign', gameId }) }, 'Resign'),
      );
    }
  };

  const statusLine = () => {
    if (!s || !game) return;
    if (game.status === 'ended') s.status.textContent = `${game.result ?? ''} · ${game.termination}`;
    else s.status.textContent = you ? (game.turn === you ? 'Your move' : 'Opponent to move') : `Spectating · ${game.turn === 'w' ? 'White' : 'Black'} to move`;
  };

  const off = net.on((m: ServerMsg) => {
    if (m.t === 'game' && m.game.id === gameId) {
      game = m.game;
      you = m.you;
      lastTick = performance.now();
      build(m.game);
    }
    if (m.t === 'move' && m.gameId === gameId && game && s) {
      game.moves.push({ uci: m.uci, san: m.san, thinkMs: m.thinkMs, clockMs: m.ply % 2 === 1 ? m.clocks.w : m.clocks.b });
      game.clocks = m.clocks;
      game.turn = m.ply % 2 === 1 ? 'b' : 'w';
      lastTick = performance.now();
      if (s.board.chess.history().length < m.ply) s.board.apply(m.uci);
      renderMoves(s);
      statusLine();
    }
    if (m.t === 'drawOffer' && m.gameId === gameId && s && you && m.by !== you) {
      clear(s.status, 'Draw offered. ', h('button', { onclick: () => net.send({ t: 'answerDraw', gameId, accept: true }) }, 'Accept'), h('button', { onclick: () => (net.send({ t: 'answerDraw', gameId, accept: false }), statusLine()) }, 'Decline'));
    }
    if (m.t === 'end' && m.game.id === gameId && s) {
      game = m.game;
      s.board.setInteractive(undefined);
      statusLine();
      const diff = m.ratingDiff && you ? ` (${m.ratingDiff[you] >= 0 ? '+' : ''}${m.ratingDiff[you]})` : '';
      s.status.textContent += diff;
      if (m.game.termination === 'aborted') return clear(s.actions, h('button', { onclick: () => (location.hash = '#/play/online') }, 'Back to lobby'));
      // Store locally with your private "considered" data attached.
      const local = new Chess();
      const plies: PlyRecord[] = m.game.moves.map((mv, i) => {
        const before = local.fen();
        const r = local.move(mv.san);
        return { ply: i + 1, side: r.color, san: r.san, uci: mv.uci, fenBefore: before, fenAfter: local.fen(), thinkMs: mv.thinkMs, clockMs: mv.clockMs, considered: considered[i + 1] };
      });
      const id = `online-${gameId}`;
      saveGame({
        id,
        at: Date.now(),
        plies,
        you,
        source: 'online',
        opponent: you === 'w' ? m.game.black.name : m.game.white.name,
        meta: {
          white: m.game.white.name,
          black: m.game.black.name,
          whiteRating: m.game.white.rating,
          blackRating: m.game.black.rating,
          initialMs: m.game.tc.initialMs,
          incrementMs: m.game.tc.incrementMs,
          result: m.game.result,
          termination: m.game.termination,
        },
      });
      clear(
        s.actions,
        h('button.primary', { onclick: () => (location.hash = `#/review/${id}`) }, 'Review with Mind Read'),
        you ? h('button', { onclick: () => net.send({ t: 'rematch', gameId }) }, 'Rematch') : null,
        h('button', { onclick: () => (location.hash = '#/play/online') }, 'Lobby'),
      );
    }
    if (m.t === 'rematchOffer' && s) s.status.append(h('div', 'Opponent wants a rematch.'));
    if (m.t === 'game' && m.game.id !== gameId && m.you) location.hash = `#/play/online/${m.game.id}`;
    if (m.t === 'error' && s && game) {
      build(game); // resync the board if the server rejected a move
      s.status.textContent = m.message;
    }
  });
  net.send({ t: 'join', gameId });
  el.append(h('p.muted', 'Joining game…'));
  return () => {
    off();
    clearInterval(timer);
  };
}
