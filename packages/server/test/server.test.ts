import { describe, expect, it } from 'vitest';
import type { ServerMsg } from '@chessbutfree/core';
import { Game } from '../src/game';
import { Hub, type Conn } from '../src/hub';

const tc = { initialMs: 60_000, incrementMs: 1_000 };
const pi = (id: string) => ({ id, name: id, rating: 1500, provisional: true });

function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('Game', () => {
  it('runs clocks with increment once both sides have moved', () => {
    const c = clock();
    const g = new Game('g', tc, true, pi('a'), pi('b'), c.now);
    c.advance(5000);
    expect(g.move('a', 'e2e4', 5000).ok).toBe(true);
    expect(g.data.clocks.w).toBe(60_000); // first moves are free
    c.advance(3000);
    g.move('b', 'e7e5', 3000);
    c.advance(10_000);
    const r = g.move('a', 'g1f3', 10_000);
    expect(r.ok && r.thinkMs).toBe(10_000);
    expect(g.data.clocks.w).toBe(60_000 - 10_000 + 1_000);
    expect(g.data.moves[2].clockMs).toBe(51_000);
  });
  it('refunds at most 1s of lag', () => {
    const c = clock();
    const g = new Game('g', tc, true, pi('a'), pi('b'), c.now);
    g.move('a', 'e2e4', 0);
    g.move('b', 'e7e5', 0);
    c.advance(4000);
    const r = g.move('a', 'g1f3', 1000); // client claims 1s, server saw 4s
    expect(r.ok && r.thinkMs).toBe(3000);
  });
  it('rejects illegal and out-of-turn moves', () => {
    const g = new Game('g', tc, true, pi('a'), pi('b'));
    expect(g.move('b', 'e7e5', 0).ok).toBe(false);
    expect(g.move('a', 'e2e5', 0).ok).toBe(false);
  });
  it('flags on time, and calls it a draw when the winner cannot mate', () => {
    const c = clock();
    const g = new Game('g', tc, true, pi('a'), pi('b'), c.now);
    g.move('a', 'e2e4', 0);
    g.move('b', 'e7e5', 0);
    c.advance(61_000);
    expect(g.tick()).toBe(true);
    expect(g.data.result).toBe('0-1');
    expect(g.data.termination).toBe('time');
  });
  it('detects checkmate and writes a PGN with clocks', () => {
    const g = new Game('g', tc, false, pi('a'), pi('b'));
    for (const [p, m] of [['a', 'f2f3'], ['b', 'e7e5'], ['a', 'g2g4'], ['b', 'd8h4']] as const) g.move(p, m, 0);
    expect(g.data.result).toBe('0-1');
    expect(g.data.termination).toBe('checkmate');
    expect(g.pgn()).toMatch(/%clk/);
  });
});

describe('Hub', () => {
  const conn = () => {
    const inbox: ServerMsg[] = [];
    return { inbox, send: (m: ServerMsg) => inbox.push(m) } as Conn & { inbox: ServerMsg[] };
  };
  it('pairs two seeks, plays, rates', () => {
    const hub = new Hub();
    const ca = conn();
    const cb = conn();
    const a = hub.connect(ca, { t: 'hello', name: 'Ann' });
    const b = hub.connect(cb, { t: 'hello', name: 'Bob' });
    hub.handle(a.id, { t: 'seek', tc, rated: true }, ca);
    hub.handle(b.id, { t: 'seek', tc, rated: true }, cb);
    const start = ca.inbox.find((m) => m.t === 'game') as Extract<ServerMsg, { t: 'game' }>;
    expect(start).toBeTruthy();
    const gameId = start.game.id;
    const white = start.you === 'w' ? a : b;
    const black = start.you === 'w' ? b : a;
    hub.handle(white.id, { t: 'move', gameId, uci: 'e2e4', thinkMs: 0 }, ca);
    hub.handle(black.id, { t: 'resign', gameId }, cb);
    const end = ca.inbox.find((m) => m.t === 'end') as Extract<ServerMsg, { t: 'end' }>;
    expect(end.game.result).toBe('1-0');
    expect(end.ratingDiff!.w).toBeGreaterThan(0);
    expect(end.ratingDiff!.b).toBeLessThan(0);
    expect(hub.finished).toHaveLength(1);
  });
  it('private games join by link, spectators can watch', () => {
    const hub = new Hub();
    const ca = conn();
    const cb = conn();
    const cs = conn();
    const a = hub.connect(ca, { t: 'hello' });
    const b = hub.connect(cb, { t: 'hello' });
    const s = hub.connect(cs, { t: 'hello' });
    hub.handle(a.id, { t: 'createPrivate', tc }, ca);
    const created = ca.inbox.find((m) => m.t === 'privateCreated') as Extract<ServerMsg, { t: 'privateCreated' }>;
    hub.handle(b.id, { t: 'join', gameId: created.gameId }, cb);
    expect(cb.inbox.some((m) => m.t === 'game')).toBe(true);
    hub.handle(s.id, { t: 'watch', gameId: created.gameId }, cs);
    const g = cs.inbox.find((m) => m.t === 'game') as Extract<ServerMsg, { t: 'game' }>;
    expect(g.you).toBeUndefined();
  });
});

describe('voice chat signalling', () => {
  it('relays WebRTC signals to the opponent only', () => {
    const hub = new Hub();
    const inbox = () => {
      const box: ServerMsg[] = [];
      return { box, send: (m: ServerMsg) => box.push(m) } as Conn & { box: ServerMsg[] };
    };
    const ca = inbox();
    const cb = inbox();
    const cs = inbox();
    const a = hub.connect(ca, { t: 'hello' });
    const b = hub.connect(cb, { t: 'hello' });
    const s = hub.connect(cs, { t: 'hello' });
    hub.handle(a.id, { t: 'seek', tc, rated: false }, ca);
    hub.handle(b.id, { t: 'seek', tc, rated: false }, cb);
    const g = ca.box.find((m) => m.t === 'game') as Extract<ServerMsg, { t: 'game' }>;
    hub.handle(s.id, { t: 'watch', gameId: g.game.id }, cs);
    hub.handle(a.id, { t: 'signal', gameId: g.game.id, data: { description: { type: 'offer', sdp: 'x' } } }, ca);
    expect(cb.box.some((m) => m.t === 'signal')).toBe(true);
    expect(cs.box.some((m) => m.t === 'signal')).toBe(false);
    expect(ca.box.some((m) => m.t === 'signal')).toBe(false);
  });
});
