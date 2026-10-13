// Builds packages/core/src/data/openings.json from the CC0 lichess-org/chess-openings dataset.
// Usage: node scripts/build-openings.mjs   (downloads a.tsv..e.tsv if packages/core/data is empty)
import { Chess } from 'chess.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const dataDir = new URL('../packages/core/data/', import.meta.url);
const outFile = new URL('../packages/core/src/data/openings.json', import.meta.url);
mkdirSync(dataDir, { recursive: true });
mkdirSync(new URL('./', outFile), { recursive: true });

const rows = [];
for (const letter of ['a', 'b', 'c', 'd', 'e']) {
  const file = new URL(`${letter}.tsv`, dataDir);
  if (!existsSync(file)) {
    const res = await fetch(`https://raw.githubusercontent.com/lichess-org/chess-openings/master/${letter}.tsv`);
    writeFileSync(file, await res.text());
  }
  const lines = readFileSync(file, 'utf8').trim().split('\n').slice(1);
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t');
    const chess = new Chess();
    chess.loadPgn(pgn);
    const epd = chess.fen().split(' ').slice(0, 4).join(' ');
    const uci = chess.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? '')).join(' ');
    rows.push([eco, name, uci, epd]);
  }
}
writeFileSync(outFile, JSON.stringify(rows));
console.log(`wrote ${rows.length} openings`);
