import { BOT_LEVELS, BOTS, botSays, chooseBotMove, COACHES, expectedPoints, lineToCp, parseSpokenMove, speakMove, type BotMoment, type BotPersona } from '@chessbutfree/core';
import { arrow, Board } from '../board';
import { avatar, boardLayout, bubble, gameOverModal, img3d, moveTable, navButtons, panelHead, TC_CATS, type BoardLayout, type TC } from '../components';
import { clear, h } from '../dom';
import { engine } from '../engine';
import { icon } from '../icons';
import { LocalGame, resultOf, resultTitle } from '../localgame';
import type { View } from '../main';
import { play } from '../sound';
import { newId, pref, saveGame, setPref } from '../store';
import { canListen, listen, onSpeaking, speak, stopSpeaking } from '../voice';

interface Opponent {
  id: string; // avatar id
  name: string;
  persona: BotPersona;
  blurb: string;
  coach?: boolean;
}

const MASKS: Opponent[] = BOTS.map((b) => ({ id: b.id, name: b.name, persona: b, blurb: b.blurb }));
const COACH_OPP: Opponent[] = COACHES.map((c) => ({
  id: c.id,
  name: c.name,
  persona: BOTS.find((b) => b.id === c.sparsAs)!,
  blurb: c.philosophy,
  coach: true,
}));
const ALL = [...MASKS, ...COACH_OPP];

const ratingOf = (levelId: number) => Number(BOT_LEVELS.find((l) => l.id === levelId)!.label.match(/(\d+)/)![1]);

export const botsView: View = (el, _p, query) => {
  const L = boardLayout();
  el.append(L.root);
  const board = new Board(L.boardHost, { sound: true });
  let oppId = query.get('bot') ?? pref('bot', 'professor');
  let level = Number(query.get('level') ?? pref('level', 3));
  let color: 'w' | 'b' | 'r' = (query.get('color') as 'w' | 'b' | null) ?? pref('botColor', 'w');
  let tcKey = query.get('tc') ?? pref('botTc', 'none');
  const opp = () => ALL.find((o) => o.id === oppId) ?? MASKS[3];
  const local = location.hash.includes('/play/local');

  const showBars = () => {
    L.top.set({ name: local ? 'Black' : opp().name, rating: local ? undefined : ratingOf(level), avatar: local ? avatar() : avatar(opp().id) });
    L.bottom.set({ name: local ? 'White' : 'You', avatar: avatar() });
    L.top.clock(null);
    L.bottom.clock(null);
  };
  showBars();

  const setup = () => {
    const o = opp();
    clear(
      L.panel,
      panelHead(local ? 'Pass & Play' : 'Play Bots', img3d('bots')),
      h(
        'div.panel-body',
        local
          ? h('div.bubble', h('div.say', 'Two players, one device. Think times are still recorded, so Game Review can read both minds.'))
          : [
              h('div.bot-hero', h('img', { src: avatar(o.id), alt: '' }), h('div.nm', o.name, ' ', h('span', String(ratingOf(level)))), h('span.pill', o.coach ? 'Coach' : o.persona.archetype)),
              bubble(avatar(o.id), o.coach ? `“${o.blurb}”` : botSays(o.persona, 'greet', 0)),
              category('Mind Masks', MASKS, o.id, (id) => ((oppId = id), setPref('bot', id), setup(), showBars())),
              category('Coaches', COACH_OPP, o.id, (id) => ((oppId = id), setPref('bot', id), setup(), showBars())),
            ],
      ),
      h(
        'div.panel-foot',
        h(
          'div.row',
          local
            ? null
            : h(
                'select.input',
                { onchange: (e: Event) => ((level = Number((e.target as HTMLSelectElement).value)), setPref('level', level), setup(), showBars()) },
                BOT_LEVELS.map((l) => h('option', { value: l.id, selected: l.id === level }, l.label)),
              ),
          h(
            'select.input',
            { onchange: (e: Event) => ((tcKey = (e.target as HTMLSelectElement).value), setPref('botTc', tcKey)) },
            h('option', { value: 'none', selected: tcKey === 'none' }, 'No timer'),
            TC_CATS.flatMap((c) => c.opts).map(([l, t]) => h('option', { value: `${t.initialMs}+${t.incrementMs}`, selected: tcKey === `${t.initialMs}+${t.incrementMs}` }, l)),
          ),
        ),
        local
          ? null
          : h(
              'div.row',
              (['w', 'r', 'b'] as const).map((c) =>
                h('button.btn.sm', { style: color === c ? 'outline:2px solid var(--green)' : '', onclick: () => ((color = c), setPref('botColor', c), setup()) }, c === 'w' ? 'White' : c === 'b' ? 'Black' : 'Random'),
              ),
            ),
        local
          ? null
          : h(
              'button.btn.sm',
              {
                style: pref('voiceMode', false) ? 'outline:2px solid var(--green)' : '',
                title: 'Speak your moves; the bot talks back',
                onclick: () => (setPref('voiceMode', !pref('voiceMode', false)), setup()),
              },
              icon('mic'),
              `Voice Mode: ${pref('voiceMode', false) ? 'On' : 'Off'}`,
            ),
        h('button.btn.green.xl', { onclick: () => start() }, 'Play'),
      ),
    );
    if (!local) speak(o.id, o.coach ? o.blurb : botSays(o.persona, 'greet', 0));
  };

  let stop = () => {};
  const start = () => {
    const tc: TC | null = tcKey === 'none' ? null : { initialMs: Number(tcKey.split('+')[0]), incrementMs: Number(tcKey.split('+')[1]) };
    const you: 'w' | 'b' = color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
    stop = local ? runLocal(L, board, tc) : runBot(L, board, opp(), BOT_LEVELS.find((l) => l.id === level)!, you, tc, setup);
  };

  setup();
  return () => stop();
};

function category(title: string, list: Opponent[], current: string, pick: (id: string) => void): HTMLElement {
  return h(
    'div.bot-cat',
    h('div.h', title, h('span', `${list.length} bots`)),
    h('div.avs', list.map((o) => h('img', { src: avatar(o.id), alt: o.name, title: o.name, class: o.id === current ? 'on' : '', onclick: () => pick(o.id) }))),
  );
}

function runBot(L: BoardLayout, board: Board, o: Opponent, level: (typeof BOT_LEVELS)[number], you: 'w' | 'b', tc: TC | null, back: () => void): () => void {
  const game = new LocalGame({ white: you === 'w' ? 'You' : o.name, black: you === 'b' ? 'You' : o.name }, tc);
  const youColor = you === 'w' ? 'white' : 'black';
  board.load(game.fen);
  board.orientation(youColor);
  board.setInteractive(youColor);
  board.shapes([]);
  let view = 0; // ply being shown (for navigation)
  let lastSay = botSays(o.persona, 'greet');
  let thinking = false;
  const sayBox = h('div');
  const movesBox = h('div');
  const voiceMode = pref('voiceMode', false);
  let heard = '';
  let listening: 'listening' | 'stopped' | 'error' = 'stopped';
  let listenMsg = '';
  const say = (m: BotMoment, prefix = '') => {
    lastSay = botSays(o.persona, m);
    clear(sayBox, bubble(avatar(o.id), lastSay));
    speak(o.id, prefix ? `${prefix}. ${lastSay}` : lastSay);
  };
  const offSpeak = onSpeaking((who) => L.top.speaking(who === o.id));

  const end = (result: '1-0' | '0-1' | '1/2-1/2', termination: string) => {
    if (game.over) return;
    game.over = true;
    Object.assign(game.meta, { result, termination });
    board.setInteractive(undefined);
    const won = (result === '1-0' && you === 'w') || (result === '0-1' && you === 'b');
    say(result === '1/2-1/2' ? 'draw' : won ? 'lose' : 'win');
    play('end');
    const id = newId();
    saveGame({ id, at: Date.now(), plies: game.plies, meta: game.meta, you, source: 'bot', opponent: o.name });
    gameOverModal({
      title: resultTitle(result, you),
      subtitle: `by ${termination}`,
      white: { name: game.meta.white!, avatar: you === 'w' ? avatar() : avatar(o.id) },
      black: { name: game.meta.black!, avatar: you === 'b' ? avatar() : avatar(o.id) },
      winner: result === '1-0' ? 'w' : result === '0-1' ? 'b' : undefined,
      coachAvatar: avatar(pref('coach', 'kiyo')),
      onReview: () => (location.hash = `#/review/${id}`),
      actions: [
        ['New Bot', back],
        ['Rematch', () => runBot(L, board, o, level, you === 'w' ? 'b' : 'w', tc, back)],
      ],
    });
    renderPanel();
  };

  const afterMove = () => {
    view = game.plies.length;
    renderMoves();
    L.top.captured(game.fen, you === 'w' ? 'b' : 'w');
    L.bottom.captured(game.fen, you);
    const r = resultOf(board.chess);
    if (r) return end(r.result as '1-0' | '0-1' | '1/2-1/2', r.termination);
    if (board.chess.turn() !== you) botMove();
  };

  const botMove = async () => {
    thinking = true;
    const t0 = performance.now();
    const fen = board.chess.fen();
    const ev = await engine().analyse(fen, { depth: level.depth, multipv: 5 });
    if (game.over || board.chess.fen() !== fen) return;
    const uci = chooseBotMove(fen, ev.lines, o.persona, level);
    const wait = Math.max(0, 350 + Math.random() * 900 - (performance.now() - t0));
    setTimeout(() => {
      if (game.over || board.chess.fen() !== fen) return;
      thinking = false;
      const san = board.apply(uci);
      if (!san) return;
      game.record(uci, Math.round(performance.now() - t0));
      // Chat: react to the moment, in character.
      const ep = ev.lines[0] ? expectedPoints(lineToCp(ev.lines[0])) : 0.5;
      const announce = voiceMode ? speakMove(san) : '';
      if (san.includes('+')) say('check', announce);
      else if (san.includes('x') && Math.random() < 0.5) say('capture', announce);
      else if (ep > 0.8 && Math.random() < 0.3) say('winning', announce);
      else if (ep < 0.2 && Math.random() < 0.35) say('losing', announce);
      else if (announce) speak(o.id, announce);
      afterMove();
    }, wait);
  };

  board.setOnMove((uci, m) => {
    if (view !== game.plies.length) return;
    game.record(uci, m.thinkMs, m.considered);
    afterMove();
  });

  const show = (ply: number) => {
    view = Math.max(0, Math.min(game.plies.length, ply));
    const p = game.plies[view - 1];
    board.load(p ? p.fenAfter : game.plies[0]?.fenBefore ?? board.chess.fen(), p?.uci);
    board.setInteractive(view === game.plies.length && !game.over ? youColor : undefined);
    renderMoves();
  };

  const renderMoves = () => clear(movesBox, moveTable(game.plies.map((p) => p.san), view, show));
  const voiceBox = h('div');
  const renderVoice = () =>
    clear(
      voiceBox,
      h(
        'div',
        { style: 'display:flex;flex-direction:column;gap:6px' },
        h('span.listen-pill', { class: listening === 'listening' ? '' : 'off' }, h('span.dot'), listening === 'listening' ? 'Listening — say your move' : listenMsg || 'Voice Mode paused'),
        heard ? h('div.dim', { style: 'font-size:13px;font-weight:700' }, `Heard: “${heard}”`) : null,
        h('div.dim', { style: 'font-size:12px' }, 'Try “knight f3”, “bishop takes c6”, “castle kingside”, “hint”, “takeback”, “resign”.'),
      ),
    );

  const renderPanel = () => {
    clear(
      L.panel,
      h('div.panel-head', { style: 'justify-content:flex-start;gap:12px;font-size:17px' }, h('img', { src: avatar(o.id), alt: '', style: 'width:40px;height:40px;border-radius:4px' }), `${o.name} · ${level.label}`),
      h('div.panel-body', sayBox, voiceMode ? voiceBox : null, movesBox),
      h(
        'div.panel-foot',
        game.over
          ? h('div.row', h('button.btn.green', { onclick: () => back() }, 'New Bot'), h('button.btn', { onclick: () => runBot(L, board, o, level, you, tc, back) }, 'Rematch'))
          : h(
              'div.row',
              h('button.btn.sm', {
                title: 'Hint',
                onclick: async () => {
                  if (thinking) return;
                  const ev = await engine().analyse(board.chess.fen(), { depth: 12 });
                  if (ev.lines[0]) board.shapes([arrow(ev.lines[0].move, 'blue')]);
                },
              }, icon('bulb'), 'Hint'),
              h('button.btn.sm', {
                title: 'Takeback',
                onclick: () => {
                  if (thinking || game.plies.length < 2) return;
                  game.takeback(board.chess.turn() === you ? 2 : 1);
                  board.load(game.fen, game.plies[game.plies.length - 1]?.uci);
                  board.setInteractive(youColor);
                  view = game.plies.length;
                  renderMoves();
                },
              }, icon('undo'), 'Takeback'),
              h('button.btn.sm', { title: 'Resign', onclick: () => end(you === 'w' ? '0-1' : '1-0', 'resignation') }, icon('flag'), 'Resign'),
            ),
        navButtons((w) => show(w === 'first' ? 0 : w === 'prev' ? view - 1 : w === 'next' ? view + 1 : game.plies.length)),
      ),
    );
    clear(sayBox, bubble(avatar(o.id), lastSay));
    renderMoves();
  };

  L.top.set({ name: o.name, rating: ratingOf(level.id), avatar: avatar(o.id), chip: o.coach ? 'Coach' : undefined });
  L.bottom.set({ name: 'You', avatar: avatar() });
  renderPanel();
  play('start');
  game.start();
  const timer = window.setInterval(() => {
    if (!tc) return;
    const c = game.live();
    const theirs = you === 'w' ? 'b' : 'w';
    L.bottom.clock(c[you], !game.over && board.chess.turn() === you);
    L.top.clock(c[theirs], !game.over && board.chess.turn() === theirs);
    const f = game.flagged();
    if (f) end(f === 'w' ? '0-1' : '1-0', 'timeout');
  }, 100);
  if (!tc) {
    L.top.clock(null);
    L.bottom.clock(null);
  }
  afterMove();
  let stopListening = () => {};
  if (voiceMode) {
    if (!canListen()) listenMsg = 'Speech recognition needs Chrome or Edge.';
    stopListening = listen(
      (alts) => {
        heard = alts[0]?.trim() ?? '';
        const text = alts.join(' | ').toLowerCase();
        if (game.over) return renderVoice();
        if (/\bresign\b/.test(text)) return end(you === 'w' ? '0-1' : '1-0', 'resignation');
        if (/\b(hint|help)\b/.test(text)) {
          (L.panel.querySelector('button[title="Hint"]') as HTMLButtonElement | null)?.click();
          return renderVoice();
        }
        if (/\b(take ?back|undo)\b/.test(text)) {
          (L.panel.querySelector('button[title="Takeback"]') as HTMLButtonElement | null)?.click();
          return renderVoice();
        }
        if (board.chess.turn() !== you || view !== game.plies.length || thinking) {
          speak('narrator', 'Wait for your turn.');
          return renderVoice();
        }
        const fen = board.chess.fen();
        const uci = alts.map((a) => parseSpokenMove(a, fen)).find(Boolean);
        if (!uci) {
          speak('narrator', 'Sorry, I did not catch a legal move.');
          return renderVoice();
        }
        const san = board.apply(uci);
        if (san) {
          game.record(uci, 0);
          afterMove();
        }
        renderVoice();
      },
      (st, msg) => {
        listening = st;
        listenMsg = msg ?? '';
        renderVoice();
      },
    );
    renderVoice();
  }
  return () => {
    game.over = true;
    clearInterval(timer);
    stopListening();
    offSpeak();
    stopSpeaking();
  };
}

function runLocal(L: BoardLayout, board: Board, tc: TC | null): () => void {
  const game = new LocalGame({ white: 'White', black: 'Black' }, tc);
  board.load(game.fen);
  board.orientation('white');
  board.setInteractive('both');
  const movesBox = h('div');
  const end = (result: '1-0' | '0-1' | '1/2-1/2', termination: string) => {
    if (game.over) return;
    game.over = true;
    Object.assign(game.meta, { result, termination });
    board.setInteractive(undefined);
    play('end');
    const id = newId();
    saveGame({ id, at: Date.now(), plies: game.plies, meta: game.meta, source: 'local' });
    gameOverModal({
      title: resultTitle(result),
      subtitle: `by ${termination}`,
      white: { name: 'White', avatar: avatar() },
      black: { name: 'Black', avatar: avatar() },
      winner: result === '1-0' ? 'w' : result === '0-1' ? 'b' : undefined,
      coachAvatar: avatar(pref('coach', 'kiyo')),
      onReview: () => (location.hash = `#/review/${id}`),
      actions: [['New Game', () => location.reload()]],
    });
  };
  board.setOnMove((uci, m) => {
    game.record(uci, m.thinkMs, m.considered);
    clear(movesBox, moveTable(game.plies.map((p) => p.san), game.plies.length, () => {}));
    L.top.captured(game.fen, 'b');
    L.bottom.captured(game.fen, 'w');
    const r = resultOf(board.chess);
    if (r) end(r.result as '1-0' | '0-1' | '1/2-1/2', r.termination);
  });
  clear(
    L.panel,
    panelHead('Pass & Play', img3d('play')),
    h('div.panel-body', movesBox),
    h('div.panel-foot', h('button.btn', { onclick: () => end(board.chess.turn() === 'w' ? '0-1' : '1-0', 'resignation') }, icon('flag'), 'Resign (side to move)')),
  );
  clear(movesBox, moveTable([], 0, () => {}));
  play('start');
  game.start();
  const timer = window.setInterval(() => {
    if (!tc) return;
    const c = game.live();
    L.bottom.clock(c.w, !game.over && board.chess.turn() === 'w');
    L.top.clock(c.b, !game.over && board.chess.turn() === 'b');
    const f = game.flagged();
    if (f) end(f === 'w' ? '0-1' : '1-0', 'timeout');
  }, 100);
  return () => {
    game.over = true;
    clearInterval(timer);
  };
}
