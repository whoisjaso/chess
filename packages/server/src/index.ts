import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMsg, ServerMsg } from '@mindboard/core';
import { Hub, type Conn } from './hub';

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? fileURLToPath(new URL('../data/', import.meta.url));
const STATIC_DIR = fileURLToPath(new URL('../../web/dist/', import.meta.url));
const STATE_FILE = join(DATA_DIR, 'state.json');

const hub = new Hub();
mkdirSync(DATA_DIR, { recursive: true });
if (existsSync(STATE_FILE)) hub.load(JSON.parse(readFileSync(STATE_FILE, 'utf8')));
const save = () => writeFileSync(STATE_FILE, JSON.stringify(hub.snapshot()));
setInterval(save, 30_000).unref();
setInterval(() => hub.tick(), 100).unref();
process.on('SIGINT', () => {
  save();
  process.exit(0);
});

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
};

/** Serves the built web app (if present) and the WebSocket endpoint at /ws. */
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, games: hub.games.size, players: hub.players.size }));
  }
  if (url.pathname.startsWith('/api/games/')) {
    const game = hub.finished.find((g) => g.id === url.pathname.split('/').pop());
    res.writeHead(game ? 200 : 404, { 'content-type': 'application/x-chess-pgn' });
    return res.end(game?.pgn ?? '');
  }
  let file = normalize(join(STATIC_DIR, url.pathname));
  if (!file.startsWith(STATIC_DIR) || !existsSync(file) || statSync(file).isDirectory()) file = join(STATIC_DIR, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('Mindboard server is running. Build the web app (npm run build) or run it with `npm run dev`.');
  }
  // Cross-origin isolation lets the multi-threaded Stockfish build use SharedArrayBuffer.
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-embedder-policy': 'require-corp',
  });
  createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', (ws: WebSocket) => {
  const conn: Conn = { send: (m: ServerMsg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m)) };
  let playerId: string | undefined;
  let budget = 30; // simple flood control: 30 messages per second
  const refill = setInterval(() => (budget = 30), 1000);
  ws.on('message', (raw) => {
    if (--budget < 0) return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.t === 'hello') playerId = hub.connect(conn, msg).id;
    else if (playerId) hub.handle(playerId, msg, conn);
    else conn.send({ t: 'error', message: 'say hello first' });
  });
  ws.on('close', () => {
    clearInterval(refill);
    hub.disconnect(conn, playerId);
  });
});

server.listen(PORT, () => console.log(`Mindboard server on http://localhost:${PORT}  (ws: /ws)`));
