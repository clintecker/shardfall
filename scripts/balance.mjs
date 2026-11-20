#!/usr/bin/env node
// Plays AI-only games headlessly and prints who wins. A quick way to see whether a rules or
// tuning change tilted the table before anyone has to play thirty turns by hand.
//
//   npm run balance            200 games
//   npm run balance -- 1000    more games, tighter numbers
//
// Every seat, including "yours", is driven by the rival AI, so this measures the cultures and
// the map, not player skill. Games are seeded: the same count always prints the same table.
import { createGame } from '../test/helpers/sandbox.mjs';

const games = Number(process.argv[2]) || 200;
const CULTURES = ['helion', 'verdant', 'choir', 'tide'];
const LAYOUTS = ['balanced', 'islands', 'highlands', 'wilds'];
const SIZES = [9, 11, 13];

const tally = Object.fromEntries(
  CULTURES.map(k => [k, { played: 0, won: 0, conquest: 0, score: 0 }])
);
let conquests = 0,
  turns = 0;
const t0 = Date.now();

for (let seed = 1; seed <= games; seed++) {
  const g = createGame({ seed });
  g.start({
    culture: CULTURES[seed % 4],
    layout: LAYOUTS[(seed >> 2) % 4],
    size: SIZES[seed % 3],
    rivals: 3
  });
  while (!g.G.over) {
    await g.call('aiTurn', 0);
    if (!g.G.over) await g.call('endTurn');
  }
  const G = g.G;
  const byConquest = G.turn <= G.maxTurns;
  if (byConquest) conquests++;
  turns += Math.min(G.turn, G.maxTurns);
  for (const f of G.factions) {
    const row = tally[f.key];
    row.played++;
    row.score += g.call('score', f.i);
    if (f.i === G.winner) {
      row.won++;
      if (byConquest) row.conquest++;
    }
  }
}

const pct = (a, b) => ((100 * a) / b).toFixed(1).padStart(5) + '%';
console.log(`${games} four-way AI games in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(
  `ended by conquest: ${pct(conquests, games)}   average length: ${(turns / games).toFixed(1)} turns\n`
);
console.log('culture    win rate   by conquest   avg score');
for (const k of CULTURES) {
  const r = tally[k];
  console.log(
    `${k.padEnd(10)} ${pct(r.won, r.played)}     ${pct(r.conquest, Math.max(1, r.won))}      ${Math.round(
      r.score / r.played
    )
      .toString()
      .padStart(6)}`
  );
}
console.log(
  '\nA fair four-way table is 25% each. Small samples wobble: run 1000+ before believing a gap.'
);
