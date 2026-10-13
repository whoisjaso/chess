/** Wire protocol between the web client and the multiplayer server (JSON over WebSocket). */

export interface TimeControl {
  initialMs: number;
  incrementMs: number;
}

export type Speed = 'bullet' | 'blitz' | 'rapid' | 'classical';

/** Lichess-style speed buckets by estimated game duration (initial + 40 x increment). */
export function speedOf(tc: TimeControl): Speed {
  const est = tc.initialMs / 1000 + (40 * tc.incrementMs) / 1000;
  if (est < 180) return 'bullet';
  if (est < 480) return 'blitz';
  if (est < 1500) return 'rapid';
  return 'classical';
}

export interface PlayerInfo {
  id: string;
  name: string;
  rating: number;
  provisional: boolean;
}

export interface WireGame {
  id: string;
  tc: TimeControl;
  rated: boolean;
  white: PlayerInfo;
  black: PlayerInfo;
  startFen: string;
  moves: { uci: string; san: string; thinkMs: number; clockMs: number }[];
  clocks: { w: number; b: number };
  turn: 'w' | 'b';
  status: 'waiting' | 'playing' | 'ended';
  result?: '1-0' | '0-1' | '1/2-1/2';
  termination?: string;
  drawOfferBy?: 'w' | 'b';
}

export type ClientMsg =
  | { t: 'hello'; playerId?: string; name?: string }
  | { t: 'seek'; tc: TimeControl; rated: boolean }
  | { t: 'cancelSeek' }
  | { t: 'createPrivate'; tc: TimeControl }
  | { t: 'join'; gameId: string }
  | { t: 'watch'; gameId: string }
  | { t: 'move'; gameId: string; uci: string; thinkMs: number }
  | { t: 'resign'; gameId: string }
  | { t: 'offerDraw'; gameId: string }
  | { t: 'answerDraw'; gameId: string; accept: boolean }
  | { t: 'abort'; gameId: string }
  | { t: 'rematch'; gameId: string }
  /** WebRTC voice-chat handshake, relayed to the opponent only. */
  | { t: 'signal'; gameId: string; data: unknown }
  | { t: 'ping' };

export type ServerMsg =
  | { t: 'welcome'; playerId: string; name: string; ratings: Record<Speed, number> }
  | { t: 'lobby'; online: number; playing: number; seeks: { tc: TimeControl; count: number }[] }
  | { t: 'seeking'; tc: TimeControl }
  | { t: 'privateCreated'; gameId: string }
  | { t: 'game'; game: WireGame; you?: 'w' | 'b' }
  | { t: 'move'; gameId: string; uci: string; san: string; fen: string; clocks: { w: number; b: number }; ply: number; thinkMs: number }
  | { t: 'drawOffer'; gameId: string; by: 'w' | 'b' }
  | { t: 'end'; game: WireGame; ratingDiff?: { w: number; b: number }; pgn: string }
  | { t: 'rematchOffer'; gameId: string }
  | { t: 'signal'; gameId: string; data: unknown }
  | { t: 'error'; message: string }
  | { t: 'pong'; now: number };
