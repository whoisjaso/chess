import type { PlyRecord, ServerMsg, Speed, WireGame } from '@chessbutfree/core';
import { Chess } from 'chess.js';
import { Board } from '../board';
import { avatar, boardLayout, gameOverModal, img3d, modal, moveTable, navButtons, panelHead, tabs, tcLabel, tcPicker, type TC } from '../components';
import { clear, h } from '../dom';
import { icon } from '../icons';
import type { View } from '../main';
import { net } from '../net';
import { play } from '../sound';
import { listGames, pref, saveGame, setPref } from '../store';
import { VoiceChat } from '../voicechat';

/* =================================================================== lobby */

export const onlineView: View = (el) => {
  const L = boardLayout();
  el.append(L.root);
  new Board(L.boardHost, { viewOnly: true, sound: false });
  let tc: TC = pref('onlineTc', { initialMs: 600_000, incrementMs: 0 });
  let tab: 'new' | 'games' | 'players' = 'new';
  let seeking: TC | null = null;
  let friendLink = '';
  let lobby = { online: 0, playing: 0 };
  let ratings: Record<Speed, number> | null = null;

  const bars = () => {
    L.top.set({ name: 'Opponent', avatar: avatar() });
    L.bottom.set({ name: net.name || 'You', rating: ratings ? ratings[speedOf(tc)] : undefined, avatar: avatar() });
    L.top.clock(tc.initialMs, false);
    L.bottom.clock(tc.initialMs, false);
  };

  const render = () => {
    bars();
    const body =
      tab === 'new'
        ? [
            tcPicker(tc, (t) => ((tc = t), setPref('onlineTc', t), render())),
            seeking
              ? h('div.banner.info', icon('stopwatch'), `Searching for a ${tcLabel(seeking)} game…`, h('button.btn.sm', { style: 'margin-left:auto', onclick: () => (net.send({ t: 'cancelSeek' }), (seeking = null), render()) }, 'Cancel'))
              : h('button.btn.green.xl', { onclick: () => net.send({ t: 'seek', tc, rated: pref('rated', true) }) }, 'Start Game'),
            h('div', { style: 'height:6px' }),
            h('div.tile', { onclick: customChallenge }, h('span.ico', icon('swords')), h('span.t', 'Custom Challenge', h('small', 'Pick rated or casual'))),
            h('div.tile', { onclick: () => net.send({ t: 'createPrivate', tc }) }, h('span.ico', icon('handshake')), h('span.t', 'Play a Friend', h('small', 'Share a link to your game'))),
            friendLink ? h('input.input', { value: friendLink, readOnly: true, onclick: (e: Event) => (e.target as HTMLInputElement).select() }) : null,
            friendLink ? h('div.dim', { style: 'font-size:13px' }, 'Link copied. The game starts when your friend opens it.') : null,
            h('a.tile', { href: '#/play/bots' }, h('img', { src: img3d('bots'), alt: '' }), h('span.t', 'Play Bots', h('small', 'Six masks, six levels'))),
            h('a.tile', { href: '#/play/local' }, h('img', { src: img3d('play'), alt: '' }), h('span.t', 'Pass & Play', h('small', 'Two players, one device'))),
          ]
        : tab === 'games'
          ? gamesList()
          : playersTab(ratings, lobby.online);
    clear(
      L.panel,
      tabs(
        [
          { id: 'new', label: 'New Game', icon: 'plus' },
          { id: 'games', label: 'Games', icon: 'board' },
          { id: 'players', label: 'Players', icon: 'players' },
        ],
        tab,
        (t) => ((tab = t), render()),
      ),
      h('div.panel-body', body),
      h('div.panel-foot', h('div.panel-stats', h('b', lobby.playing.toLocaleString()), ' PLAYING · ', h('b', lobby.online.toLocaleString()), ' ONLINE')),
    );
  };

  const customChallenge = () => {
    let rated = pref('rated', true);
    const body = h('div.modal-body');
    const draw = () =>
      clear(
        body,
        h('h2', { style: 'margin:0;font-size:22px;font-weight:900' }, 'Custom Challenge'),
        tcPicker(tc, (t) => ((tc = t), setPref('onlineTc', t))),
        h('div.opt-row', 'Mode', h('div.seg', [true, false].map((r) => h('button', { class: rated === r ? 'on' : '', onclick: () => ((rated = r), setPref('rated', r), draw()) }, r ? 'Rated' : 'Casual')))),
        h('button.btn.green.lg', { onclick: () => (close(), net.send({ t: 'seek', tc, rated })) }, 'Play'),
      );
    draw();
    const close = modal(body);
  };

  // If no multiplayer server answers (e.g. a static-only deployment), say so instead of spinning.
  const offlineTimer = window.setTimeout(() => {
    if (net.connected) return;
    L.panel.querySelector('.panel-body')?.prepend(
      h(
        'div.banner.info',
        { style: 'font-size:14px;align-items:flex-start' },
        icon('players'),
        h('span', 'Online play needs the ChessButFree server, which isn’t connected on this deployment yet. Bots, Voice Mode, puzzles, lessons and Game Review all work right now.'),
      ),
    );
  }, 4000);
  const off = net.on((m: ServerMsg) => {
    if (m.t === 'welcome') ratings = m.ratings;
    if (m.t === 'lobby') lobby = { online: m.online, playing: m.playing };
    if (m.t === 'seeking') seeking = m.tc;
    if (m.t === 'privateCreated') {
      friendLink = `${location.origin}${location.pathname}#/play/online/${m.gameId}`;
      void navigator.clipboard?.writeText(friendLink).catch(() => {});
    }
    if (m.t === 'game') return void (location.hash = `#/play/online/${m.game.id}`);
    render();
  });
  render();
  return () => {
    clearTimeout(offlineTimer);
    if (seeking) net.send({ t: 'cancelSeek' });
    off();
  };
};

function speedOf(tc: TC): Speed {
  const est = tc.initialMs / 1000 + (40 * tc.incrementMs) / 1000;
  return est < 180 ? 'bullet' : est < 480 ? 'blitz' : est < 1500 ? 'rapid' : 'classical';
}

function gamesList(): Node[] {
  const games = listGames().filter((g) => g.source === 'online' || g.source === 'bot');
  if (!games.length) return [h('div.dim', { style: 'text-align:center;padding:30px 0' }, 'Your finished games appear here.')];
  return games.slice(0, 40).map((g) => {
    const won = g.you && ((g.meta.result === '1-0' && g.you === 'w') || (g.meta.result === '0-1' && g.you === 'b'));
    const draw = g.meta.result === '1/2-1/2';
    return h(
      'a.tile.plain',
      { href: `#/review/${g.id}`, style: 'font-size:14px' },
      h('span', { style: `width:10px;height:10px;border-radius:2px;background:${draw ? '#8b8987' : won ? 'var(--green)' : 'var(--red)'}` }),
      h('span.t', `${g.meta.white} vs ${g.meta.black}`, h('small', `${g.meta.result} · ${g.plies.length} plies · ${new Date(g.at).toLocaleDateString()}`)),
      h('span.btn.sm', 'Review'),
    );
  });
}

function playersTab(ratings: Record<Speed, number> | null, online: number): Node[] {
  const name = h('input.input', { value: net.name, maxLength: 24, placeholder: 'Display name' });
  return [
    h('div.bot-hero', h('img', { src: avatar(), alt: '' }), h('div.nm', net.name || 'Guest')),
    h('div.row', { style: 'display:flex;gap:8px' }, name, h('button.btn.sm', { onclick: () => (setPref('name', name.value), (net.name = name.value), location.reload()) }, 'Save')),
    h(
      'div.report',
      (['bullet', 'blitz', 'rapid', 'classical'] as const).map((s) =>
        h('div.rrow', { style: 'grid-template-columns:1fr 80px' }, h('span.label', s[0].toUpperCase() + s.slice(1)), h('span.v', ratings ? String(ratings[s]) : '—')),
      ),
    ),
    h('div.dim', { style: 'font-size:13px' }, `${online} players online. Anonymous by default — your id lives in this browser.`),
  ];
}

/* =================================================================== live game */

export const gameView: View = (el, [gameId]) => {
  const L = boardLayout();
  el.append(L.root);
  let game: WireGame | null = null;
  let you: 'w' | 'b' | undefined;
  let board: Board | null = null;
  let lastTick = performance.now();
  let view = 0;
  let drawOffer: 'w' | 'b' | undefined;
  let rematchOffered = false;
  const considered: Record<number, string[]> = {};
  const movesBox = h('div');
  let vc: VoiceChat | null = null;

  const renderVoice = () => {
    if (!vc) return;
    const v = vc;
    const status = { connecting: 'Voice: connecting…', connected: 'Voice: live', failed: 'Voice: no connection', 'no-mic': 'Voice: no mic', off: '' }[v.state];
    L.bottom.extra(
      h('button.vc-btn', { class: v.micOn ? 'on' : 'off', title: v.micOn ? 'Mute your mic' : 'Unmute your mic', onclick: () => (v.setMic(!v.micOn), setPref('micOn', v.micOn)) }, icon(v.micOn ? 'mic' : 'micOff'), v.micOn ? 'Mic on' : 'Mic off'),
    );
    L.top.extra(
      h(
        'span',
        { style: 'display:inline-flex;gap:6px;align-items:center' },
        h('span.vc-status', status),
        h('button.vc-btn', { class: v.hearOn ? 'on' : 'off', title: v.hearOn ? 'Mute opponent' : 'Unmute opponent', onclick: () => (v.setHear(!v.hearOn), setPref('hearOpponent', v.hearOn)) }, icon(v.hearOn ? 'speaker' : 'speakerOff')),
      ),
    );
  };

  clear(L.panel, panelHead('Joining game…'));

  const paintClocks = () => {
    if (!game) return;
    const c = { ...game.clocks };
    if (game.status === 'playing' && game.moves.length >= 2) c[game.turn] -= performance.now() - lastTick;
    const bottom = you ?? 'w';
    const top = bottom === 'w' ? 'b' : 'w';
    L.bottom.clock(c[bottom], game.status === 'playing' && game.turn === bottom);
    L.top.clock(c[top], game.status === 'playing' && game.turn === top);
  };
  const timer = window.setInterval(paintClocks, 100);

  const fenAt = (n: number) => {
    const c = new Chess();
    for (const m of game!.moves.slice(0, n)) c.move(m.san);
    return c.fen();
  };

  const show = (n: number) => {
    if (!game || !board) return;
    view = Math.max(0, Math.min(game.moves.length, n));
    board.load(fenAt(view), game.moves[view - 1]?.uci);
    const live = view === game.moves.length && game.status === 'playing' && you;
    board.setInteractive(live ? (you === 'w' ? 'white' : 'black') : undefined);
    renderMoves();
  };

  const renderMoves = () => clear(movesBox, moveTable(game!.moves.map((m) => m.san), view, show));

  const renderPanel = () => {
    if (!game) return;
    const playing = game.status === 'playing';
    clear(
      L.panel,
      h('div.panel-head', { style: 'font-size:16px;gap:8px' }, icon(tcIconOf(game.tc)), `${tcLabel(game.tc)} · ${game.rated ? 'Rated' : 'Casual'}`),
      h(
        'div.panel-body.flush',
        drawOffer && you && drawOffer !== you
          ? h(
              'div.banner.info',
              { style: 'margin:10px' },
              icon('half'),
              'Draw offered',
              h('button.btn.sm.green', { style: 'margin-left:auto', onclick: () => net.send({ t: 'answerDraw', gameId, accept: true }) }, 'Accept'),
              h('button.btn.sm', { onclick: () => (net.send({ t: 'answerDraw', gameId, accept: false }), (drawOffer = undefined), renderPanel()) }, 'Decline'),
            )
          : null,
        rematchOffered ? h('div.banner.info', { style: 'margin:10px' }, 'Your opponent wants a rematch.', h('button.btn.sm.green', { style: 'margin-left:auto', onclick: () => net.send({ t: 'rematch', gameId }) }, 'Accept')) : null,
        movesBox,
      ),
      h(
        'div.panel-foot',
        you && playing
          ? h(
              'div.row',
              game.moves.length < 2 ? h('button.btn.sm', { onclick: () => net.send({ t: 'abort', gameId }) }, icon('x'), 'Abort') : h('button.btn.sm', { onclick: () => net.send({ t: 'offerDraw', gameId }) }, icon('half'), 'Draw'),
              h('button.btn.sm', { onclick: () => confirm('Resign this game?') && net.send({ t: 'resign', gameId }) }, icon('flag'), 'Resign'),
            )
          : !playing
            ? h('div.row', h('a.btn.green', { href: `#/review/online-${gameId}` }, 'Game Review'), you ? h('button.btn', { onclick: () => net.send({ t: 'rematch', gameId }) }, 'Rematch') : null, h('a.btn', { href: '#/play' }, 'New Game'))
            : h('div.dim', { style: 'text-align:center' }, 'Spectating'),
        navButtons((w) => show(w === 'first' ? 0 : w === 'prev' ? view - 1 : w === 'next' ? view + 1 : game!.moves.length), h('button.btn.sm', { title: 'Flip board', onclick: () => board?.flip() }, icon('flip'))),
      ),
    );
    renderMoves();
  };

  const setBars = () => {
    if (!game) return;
    const b = you === 'b' ? game.black : game.white;
    const t = you === 'b' ? game.white : game.black;
    L.bottom.set({ name: b.name, rating: `${b.rating}${b.provisional ? '?' : ''}`, avatar: avatar() });
    L.top.set({ name: t.name, rating: `${t.rating}${t.provisional ? '?' : ''}`, avatar: avatar() });
    const fen = board!.chess.fen();
    L.bottom.captured(fen, you ?? 'w');
    L.top.captured(fen, you === 'b' ? 'w' : 'b');
  };

  const off = net.on((m: ServerMsg) => {
    if (m.t === 'game' && m.game.id === gameId) {
      game = m.game;
      you = m.you;
      lastTick = performance.now();
      clear(L.boardHost);
      board = new Board(L.boardHost, {
        orientation: you === 'b' ? 'black' : 'white',
        premove: you === 'b' ? 'black' : you === 'w' ? 'white' : undefined,
        onMove: (uci, meta) => {
          considered[game!.moves.length + 1] = meta.considered;
          net.send({ t: 'move', gameId, uci, thinkMs: meta.thinkMs });
        },
      });
      view = game.moves.length;
      board.load(fenAt(view), game.moves[view - 1]?.uci);
      board.setInteractive(you && game.status === 'playing' ? (you === 'w' ? 'white' : 'black') : undefined);
      setBars();
      renderPanel();
      if (game.moves.length === 0) play('start');
      // Voice chat: on by default for the two players (mic/opponent toggles in settings).
      if (you && game.status === 'playing' && !vc && 'RTCPeerConnection' in window) {
        vc = new VoiceChat(gameId, you === 'b');
        vc.onChange = renderVoice;
        vc.onLevel = (who, on) => (who === 'me' ? L.bottom : L.top).speaking(on);
        renderVoice();
      }
    }
    if (m.t === 'signal' && m.gameId === gameId) void vc?.handle(m.data as Parameters<VoiceChat['handle']>[0]);
    if (m.t === 'game' && m.game.id !== gameId && m.you) location.hash = `#/play/online/${m.game.id}`;
    if (!game || !board) return;
    if (m.t === 'move' && m.gameId === gameId) {
      game.moves.push({ uci: m.uci, san: m.san, thinkMs: m.thinkMs, clockMs: m.ply % 2 === 1 ? m.clocks.w : m.clocks.b });
      game.clocks = m.clocks;
      game.turn = m.ply % 2 === 1 ? 'b' : 'w';
      lastTick = performance.now();
      drawOffer = undefined;
      const followingLive = view === game.moves.length - 1;
      if (followingLive) {
        view = game.moves.length;
        if (board.chess.history().length < m.ply) board.apply(m.uci);
      }
      setBars();
      renderPanel();
    }
    if (m.t === 'drawOffer' && m.gameId === gameId) {
      drawOffer = m.by;
      renderPanel();
    }
    if (m.t === 'rematchOffer' && m.gameId === gameId) {
      rematchOffered = true;
      play('notify');
      renderPanel();
    }
    if (m.t === 'error') {
      show(game.moves.length);
    }
    if (m.t === 'end' && m.game.id === gameId) {
      game = m.game;
      board.setInteractive(undefined);
      play('end');
      renderPanel();
      if (m.game.termination === 'aborted') return;
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
      const diff = (s: 'w' | 'b') => (m.ratingDiff ? `${s === 'w' ? m.game.white.rating : m.game.black.rating} (${m.ratingDiff[s] >= 0 ? '+' : ''}${m.ratingDiff[s]})` : undefined);
      const winner = m.game.result === '1-0' ? 'w' : m.game.result === '0-1' ? 'b' : undefined;
      gameOverModal({
        title: m.game.result === '1/2-1/2' ? 'Draw' : you && winner === you ? 'You Won!' : winner === 'w' ? 'White Won' : 'Black Won',
        subtitle: `by ${m.game.termination}`,
        white: { name: m.game.white.name, avatar: avatar(), rating: diff('w') },
        black: { name: m.game.black.name, avatar: avatar(), rating: diff('b') },
        winner,
        coachAvatar: avatar(pref('coach', 'kiyo')),
        onReview: () => (location.hash = `#/review/${id}`),
        actions: [
          [`New ${tcLabel(m.game.tc).split(' (')[0]}`, () => ((location.hash = '#/play'), setTimeout(() => net.send({ t: 'seek', tc: m.game.tc, rated: m.game.rated }), 300))],
          ['Rematch', () => net.send({ t: 'rematch', gameId })],
        ],
      });
    }
  });
  net.send({ t: 'join', gameId });
  return () => {
    off();
    clearInterval(timer);
    vc?.close();
  };
};

function tcIconOf(tc: TC): 'bullet' | 'blitz' | 'rapid' {
  const s = speedOf(tc);
  return s === 'bullet' ? 'bullet' : s === 'blitz' ? 'blitz' : 'rapid';
}
