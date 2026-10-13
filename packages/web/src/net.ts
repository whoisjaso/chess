import type { ClientMsg, ServerMsg } from '@chessbutfree/core';
import { pref, setPref } from './store';

type Handler = (m: ServerMsg) => void;

/** WebSocket client with auto-reconnect. Identity is an anonymous id kept in localStorage. */
class Net {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private queue: ClientMsg[] = [];
  playerId: string | undefined = pref<string | undefined>('playerId', undefined);
  name: string = pref('name', '');
  connected = false;
  private retry = 0;

  connect(): void {
    if (this.ws && this.ws.readyState <= 1) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = (import.meta.env.VITE_WS_URL as string | undefined) ?? `${proto}://${location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.retry = 0;
      ws.send(JSON.stringify({ t: 'hello', playerId: this.playerId, name: this.name || undefined } satisfies ClientMsg));
      this.queue.splice(0).forEach((m) => ws.send(JSON.stringify(m)));
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data) as ServerMsg;
      if (m.t === 'welcome') {
        this.playerId = m.playerId;
        this.name = m.name;
        setPref('playerId', m.playerId);
        setPref('name', m.name);
      }
      this.handlers.forEach((h) => h(m));
    };
    ws.onclose = () => {
      this.connected = false;
      // Back off when no server answers (e.g. a static-only deployment): 1.5s, 3s, 6s ... max 60s.
      this.retry = Math.min(60_000, this.retry ? this.retry * 2 : 1500);
      setTimeout(() => this.handlers.size && this.connect(), this.retry);
    };
  }

  send(m: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else {
      this.queue.push(m);
      this.connect();
    }
  }

  on(h: Handler): () => void {
    this.handlers.add(h);
    this.connect();
    return () => this.handlers.delete(h);
  }
}

export const net = new Net();
