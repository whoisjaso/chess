// Copies the Stockfish 17.1 lite single-threaded WASM build (GPLv3) into the web app's public folder.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const src = join(dirname(require.resolve('stockfish/package.json')), 'src');
const out = new URL('../packages/web/public/engine/', import.meta.url);
mkdirSync(out, { recursive: true });
const base = readdirSync(src).find((f) => f.startsWith('stockfish-17.1-lite-single') && f.endsWith('.js')).slice(0, -3);
copyFileSync(join(src, `${base}.js`), new URL('stockfish.js', out));
copyFileSync(join(src, `${base}.wasm`), new URL('stockfish.wasm', out));
console.log(`engine: ${base} -> packages/web/public/engine/`);
