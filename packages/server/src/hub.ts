import { randomBytes } from 'node:crypto';
import {
  DEFAULT_RATING,
  rateGame,
  speedOf,
  type ClientMsg,
  type PlayerInfo,
  type Rating,
  type ServerMsg,
  type Speed,
  type TimeControl,
} from '@mindboard/core';
import { Game } from './game';

export interface Conn {
  send(msg: ServerMsg): void;
}

interface Player {
  id: string;
  name: string;
  ratings: Record<Speed, Rating>;
  conns: Set<Conn>;
}

const SPEEDS: Speed[] = ['bullet', 'blitz', 'rapid', 'classical'];
const id = (n = 8) => randomBytes(n).toString('base64url').slice(0, n);
const tcKey = (tc: TimeControl) => `${tc.initialMs}+${tc.incrementMs}`;

export interface HubState {
  players: { id: string; name: string; ratings: Record<Speed, Rating> }[];
  finished: { id: string; pgn: string }[];
}

/**
 * The lobby + game router. Transport-agnostic so it can be tested without sockets.
 * Seeks with an identical time control are paired first-come-first-served (Chess.com's quick pairing);
 * private games are joined by link.
 */
export class Hub {
  players = new Map<string, Player>();
  games = new Map<string, Game>();
  finished: { id: string; pgn: string }[] = [];
  private seeks = new Map<string, { playerId: string; rated: boolean }[]>();
  private watchers = new Map<string, Set<Conn>>();
  private rematchOffers = new Map<string, string>();

  constructor(private now: () => number = Date.now) {}

  load(state: HubState): void {
    for (const p of state.players) this.players.set(p.id, { ...p, conns: new Set() });
    this.finished = state.finished ?? [];
  }

  snapshot(): HubState {
    return {
      players: [...this.players.values()].map(({ id, name, ratings }) => ({ id, name, ratings })),
      finished: this.finished.slice(-5000),
    };
  }

  connect(conn: Conn, msg: Extract<ClientMsg, { t: 'hello' }>): Player {
    let p = msg.playerId ? this.players.get(msg.playerId) : undefined;
    if (!p) {
      const pid = msg.playerId && /^[\w-]{8,32}$/.test(msg.playerId) ? msg.playerId : id(16);
      p = {
        id: pid,
        name: (msg.name ?? '').trim().slice(0, 24) || `Observer-${pid.slice(0, 4)}`,
        ratings: Object.fromEntries(SPEEDS.map((s) => [s, { ...DEFAULT_RATING }])) as Record<Speed, Rating>,
        conns: new Set(),
      };
      this.players.set(p.id, p);
    } else if (msg.name) p.name = msg.name.trim().slice(0, 24) || p.name;
    p.conns.add(conn);
    conn.send({
      t: 'welcome',
      playerId: p.id,
      name: p.name,
      ratings: Object.fromEntries(SPEEDS.map((s) => [s, Math.round(p!.ratings[s].rating)])) as Record<Speed, number>,
    });
    // Reconnect: resend any live game.
    for (const g of this.games.values()) {
      const color = g.colorOf(p.id);
      if (color && g.data.status === 'playing') conn.send({ t: 'game', game: { ...g.data, clocks: g.liveClocks() }, you: color });
    }
    this.broadcastLobby();
    return p;
  }

  disconnect(conn: Conn, playerId?: string): void {
    for (const set of this.watchers.values()) set.delete(conn);
    if (!playerId) return;
    const p = this.players.get(playerId);
    p?.conns.delete(conn);
    if (p && p.conns.size === 0) this.cancelSeek(playerId);
    this.broadcastLobby();
  }

  private info(p: Player, tc: TimeControl): PlayerInfo {
    const r = p.ratings[speedOf(tc)];
    return { id: p.id, name: p.name, rating: Math.round(r.rating), provisional: r.rd > 110 };
  }

  private toPlayer(playerId: string, msg: ServerMsg): void {
    this.players.get(playerId)?.conns.forEach((c) => c.send(msg));
  }

  private toGame(g: Game, msg: ServerMsg): void {
    this.toPlayer(g.data.white.id, msg);
    this.toPlayer(g.data.black.id, msg);
    this.watchers.get(g.data.id)?.forEach((c) => c.send(msg));
  }

  private start(whiteId: string, blackId: string, tc: TimeControl, rated: boolean, gameId = id()): Game {
    const w = this.players.get(whiteId)!;
    const b = this.players.get(blackId)!;
    const g = new Game(gameId, tc, rated, this.info(w, tc), this.info(b, tc), this.now);
    this.games.set(g.data.id, g);
    this.toPlayer(whiteId, { t: 'game', game: g.data, you: 'w' });
    this.toPlayer(blackId, { t: 'game', game: g.data, you: 'b' });
    return g;
  }

  seek(playerId: string, tc: TimeControl, rated: boolean, conn: Conn): void {
    if (!(tc.initialMs >= 0 && tc.initialMs <= 3 * 3600_000 && tc.incrementMs >= 0 && tc.incrementMs <= 180_000) || tc.initialMs + tc.incrementMs === 0) {
      conn.send({ t: 'error', message: 'invalid time control' });
      return;
    }
    this.cancelSeek(playerId);
    const key = tcKey(tc);
    const queue = this.seeks.get(key) ?? [];
    const match = queue.find((s) => s.playerId !== playerId && s.rated === rated);
    if (match) {
      this.seeks.set(key, queue.filter((s) => s !== match));
      const [w, b] = Math.random() < 0.5 ? [match.playerId, playerId] : [playerId, match.playerId];
      this.start(w, b, tc, rated);
    } else {
      queue.push({ playerId, rated });
      this.seeks.set(key, queue);
      conn.send({ t: 'seeking', tc });
    }
    this.broadcastLobby();
  }

  cancelSeek(playerId: string): void {
    for (const [k, q] of this.seeks) this.seeks.set(k, q.filter((s) => s.playerId !== playerId));
  }

  private pendingPrivate = new Map<string, { creator: string; tc: TimeControl }>();

  createPrivate(playerId: string, tc: TimeControl, conn: Conn): void {
    const gameId = id();
    this.pendingPrivate.set(gameId, { creator: playerId, tc });
    conn.send({ t: 'privateCreated', gameId });
  }

  join(playerId: string, gameId: string, conn: Conn): void {
    const pending = this.pendingPrivate.get(gameId);
    if (pending && pending.creator !== playerId) {
      this.pendingPrivate.delete(gameId);
      const [w, b] = Math.random() < 0.5 ? [pending.creator, playerId] : [playerId, pending.creator];
      this.start(w, b, pending.tc, false, gameId);
      return;
    }
    const g = this.games.get(gameId);
    if (g) {
      const you = g.colorOf(playerId);
      if (!you) (this.watchers.get(gameId) ?? this.watchers.set(gameId, new Set()).get(gameId)!).add(conn);
      conn.send({ t: 'game', game: { ...g.data, clocks: g.liveClocks() }, you });
    } else if (!pending) conn.send({ t: 'error', message: 'game not found' });
  }

  handle(playerId: string, msg: ClientMsg, conn: Conn): void {
    switch (msg.t) {
      case 'seek':
        return this.seek(playerId, msg.tc, msg.rated, conn);
      case 'cancelSeek':
        this.cancelSeek(playerId);
        return this.broadcastLobby();
      case 'createPrivate':
        return this.createPrivate(playerId, msg.tc, conn);
      case 'join':
      case 'watch':
        return this.join(playerId, msg.gameId, conn);
      case 'ping':
        return conn.send({ t: 'pong', now: this.now() });
      case 'hello':
        return;
    }
    const g = this.games.get(msg.gameId);
    if (!g) return conn.send({ t: 'error', message: 'game not found' });
    switch (msg.t) {
      case 'move': {
        const r = g.move(playerId, msg.uci, msg.thinkMs);
        if (r.ok) {
          this.toGame(g, { t: 'move', gameId: g.data.id, uci: msg.uci, san: r.san, fen: g.chess.fen(), clocks: g.data.clocks, ply: g.data.moves.length, thinkMs: r.thinkMs });
        } else conn.send({ t: 'error', message: r.error });
        break;
      }
      case 'resign':
        g.resign(playerId);
        break;
      case 'abort':
        g.abort(playerId);
        break;
      case 'offerDraw':
        if (g.offerDraw(playerId) && g.data.status === 'playing') this.toGame(g, { t: 'drawOffer', gameId: g.data.id, by: g.colorOf(playerId)! });
        break;
      case 'answerDraw':
        g.answerDraw(playerId, msg.accept);
        break;
      case 'rematch': {
        if (g.data.status !== 'ended' || !g.colorOf(playerId)) return;
        const other = g.colorOf(playerId) === 'w' ? g.data.black.id : g.data.white.id;
        if (this.rematchOffers.get(g.data.id) === other) {
          this.rematchOffers.delete(g.data.id);
          this.start(g.data.black.id, g.data.white.id, g.data.tc, g.data.rated);
        } else {
          this.rematchOffers.set(g.data.id, playerId);
          this.toPlayer(other, { t: 'rematchOffer', gameId: g.data.id });
        }
        return;
      }
    }
    if (g.data.status === 'ended') this.finish(g);
  }

  /** Flag check for all running games (call every ~100ms). */
  tick(): void {
    for (const g of this.games.values()) if (g.tick()) this.finish(g);
  }

  private finish(g: Game): void {
    if (g.settled) return;
    g.settled = true;
    let ratingDiff: { w: number; b: number } | undefined;
    if (g.data.rated && g.data.result && g.data.termination !== 'aborted') {
      const speed = speedOf(g.data.tc);
      const w = this.players.get(g.data.white.id)!;
      const b = this.players.get(g.data.black.id)!;
      const score = g.data.result === '1-0' ? 1 : g.data.result === '0-1' ? 0 : 0.5;
      const before = { w: w.ratings[speed].rating, b: b.ratings[speed].rating };
      const r = rateGame(w.ratings[speed], b.ratings[speed], score);
      w.ratings[speed] = r.white;
      b.ratings[speed] = r.black;
      ratingDiff = { w: Math.round(r.white.rating - before.w), b: Math.round(r.black.rating - before.b) };
    }
    const pgn = g.pgn();
    if (g.data.termination !== 'aborted') this.finished.push({ id: g.data.id, pgn });
    this.toGame(g, { t: 'end', game: g.data, ratingDiff, pgn });
    setTimeout(() => this.games.delete(g.data.id), 10 * 60_000).unref?.();
  }

  broadcastLobby(): void {
    const seeks = [...this.seeks.entries()]
      .filter(([, q]) => q.length)
      .map(([k, q]) => {
        const [i, inc] = k.split('+').map(Number);
        return { tc: { initialMs: i, incrementMs: inc }, count: q.length };
      });
    const online = [...this.players.values()].filter((p) => p.conns.size).length;
    for (const p of this.players.values()) p.conns.forEach((c) => c.send({ t: 'lobby', online, seeks }));
  }
}
