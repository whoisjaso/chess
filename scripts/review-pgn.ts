// CLI: review a PGN file with Stockfish and print the board + mind read.
// Usage: npx tsx scripts/review-pgn.ts game.pgn [depth]
import { readFileSync } from 'node:fs';
import { coachReport, pliesFromPgn, readMinds, reviewGame } from '../packages/core/src';
import { evalGame, nodeEngine } from '../packages/core/test/engine';

const [file, depthArg] = process.argv.slice(2);
const { plies, meta } = pliesFromPgn(readFileSync(file, 'utf8'));
const { engine, quit } = nodeEngine();
const evals = await evalGame(engine, plies, Number(depthArg ?? 12));
quit();
const review = reviewGame(plies, evals, meta);
const mind = readMinds(review, plies, meta);
console.log(`Opening: ${review.opening?.name ?? '—'}   White ${review.white.accuracy.toFixed(1)}%  Black ${review.black.accuracy.toFixed(1)}%\n`);
for (const r of review.plies) {
  const read = mind.reads[r.ply - 1];
  const f = mind.frame[r.ply - 1];
  console.log(
    `${String(Math.ceil(r.ply / 2)).padStart(3)}${r.side === 'w' ? '.  ' : '...'} ${r.san.padEnd(8)} ${r.classification.padEnd(10)} loss ${(r.epLoss * 100).toFixed(0).padStart(3)}  frame ${f.frame.toFixed(2).padStart(5)}  ${read.tags.map((t) => t.code).join(', ')}`,
  );
}
for (const p of [mind.white, mind.black]) {
  console.log(`\n${p.name ?? p.side}: mask ${p.mask.join(' + ')}  identity ${p.identity ?? '—'}  initiative ${(100 * p.initiativeShare).toFixed(0)}%`);
  console.log('  ' + Object.entries(p.archetypes).map(([k, v]) => `${k} ${(100 * v).toFixed(0)}%`).join('  '));
}
const report = coachReport(review, mind);
console.log('\n' + report.headline + '\n' + report.paragraphs.join('\n'));
