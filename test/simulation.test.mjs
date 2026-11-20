// Whole games, played start to finish by the rival AI on every side (yours included), with the
// state audited after every turn. This is the test that catches the bugs nobody thought to
// write a unit test for: two units on one tile, a negative bank balance, a game that never ends.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './helpers/sandbox.mjs';

const CULTURES = ['helion', 'verdant', 'choir', 'tide'];
const LAYOUTS = ['balanced', 'islands', 'highlands', 'wilds'];
const SIZES = [9, 11, 13];

function audit(g, label) {
  const G = g.G;
  const where = `${label}, turn ${G.turn}`;
  const occupied = new Set();
  for (const u of G.units) {
    const key = `${u.x},${u.y}`;
    assert.ok(!occupied.has(key), `${where}: two units share ${key}`);
    occupied.add(key);
    assert.ok(u.x >= 0 && u.y >= 0 && u.x < G.N && u.y < G.N, `${where}: unit off the board`);
    const max = g.run(`UT.${u.type}.hp`);
    assert.ok(u.hp > 0 && u.hp <= max, `${where}: ${u.type} has ${u.hp}/${max} hp`);
    const f = G.factions[u.owner];
    assert.ok(f.alive, `${where}: a fallen side still has units`);
    assert.ok(
      g.call('canEnter', f, G.tiles[u.y * G.N + u.x]),
      `${where}: ${u.type} stands on terrain it cannot enter`
    );
  }
  for (const f of G.factions) {
    assert.ok(Number.isInteger(f.flux) && f.flux >= 0, `${where}: side ${f.i} has ${f.flux} flux`);
    const cities = G.cities.filter(c => c.owner === f.i).length;
    assert.equal(
      f.alive,
      cities > 0,
      `${where}: side ${f.i} alive=${f.alive} with ${cities} cities`
    );
    for (const k of Object.keys(f.techs)) {
      const req = g.run(`TECHS.${k}.req`);
      const start = g.run(`CULTURES.find(c => c.key === '${f.key}').tech`);
      if (req && k !== start)
        assert.ok(f.techs[req], `${where}: side ${f.i} has ${k} without ${req}`);
    }
  }
  for (const c of G.cities) {
    assert.ok(
      c.level >= 1 && c.pop >= 0 && c.pop < c.level + 1,
      `${where}: ${c.name} level ${c.level} pop ${c.pop}`
    );
    assert.ok(c.owner >= -1 && c.owner < G.factions.length);
  }
  assert.ok(G.log.length <= 7, 'the log keeps the last seven lines');
}

async function playOut(seed) {
  const culture = CULTURES[seed % 4];
  const layout = LAYOUTS[(seed >> 2) % 4];
  const size = SIZES[seed % 3];
  const rivals = 1 + (seed % 3);
  const label = `seed ${seed}: ${culture}, ${size}x${size} ${layout}, ${rivals} rivals`;
  const g = createGame({ seed });
  g.start({ culture, size, layout, rivals });
  audit(g, label);
  let guard = 0;
  while (!g.G.over) {
    assert.ok(++guard <= 31, `${label}: still running after ${guard} turns`);
    await g.call('aiTurn', 0); // the player's seat is driven by the same AI as the rivals
    if (!g.G.over) await g.call('endTurn');
    audit(g, label);
  }
  return { g, label };
}

test('40 full games finish by turn 30 with a living winner and a clean state every turn', async () => {
  let conquests = 0,
    onPoints = 0,
    captures = 0,
    kills = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { g, label } = await playOut(seed);
    const G = g.G;
    assert.ok(G.winner >= 0 && G.winner < G.factions.length, label);
    assert.ok(G.factions[G.winner].alive, `${label}: the winner is dead`);
    assert.ok(G.turn <= G.maxTurns + 1, label);
    if (G.turn > G.maxTurns) {
      onPoints++;
      const best = Math.max(...G.factions.map(f => g.call('score', f.i)));
      assert.equal(
        g.call('score', G.winner),
        best,
        `${label}: the winner did not have the top score`
      );
    } else {
      conquests++;
      assert.ok(G.factions[0].alive ? G.factions.filter(f => f.alive).length === 1 : true, label);
    }
    captures += G.cities.filter(c => c.owner >= 0 && !c.capital).length;
    kills += G.factions.reduce((s, f) => s + f.kills, 0);
    assert.ok(
      g.calls.some(([name]) => name === 'showEnd'),
      `${label}: the end screen was never shown`
    );
  }
  // The AI has to actually play: expand, fight, and sometimes finish someone off.
  assert.ok(captures >= 80, `only ${captures} outposts held across 40 games`);
  assert.ok(kills >= 80, `only ${kills} kills across 40 games`);
  assert.ok(conquests + onPoints === 40);
});

test('the same seed always plays the same game', async () => {
  const a = await playOut(11);
  const b = await playOut(11);
  assert.equal(JSON.stringify(a.g.G), JSON.stringify(b.g.G));
});

test('a player who never moves is overrun or outscored, and the game still ends cleanly', async () => {
  const g = createGame({ seed: 3 });
  g.start({ size: 9, rivals: 3 });
  let guard = 0;
  while (!g.G.over) {
    assert.ok(++guard <= 31);
    await g.call('endTurn');
    audit(g, 'idle player');
  }
  assert.notEqual(g.G.winner, 0, 'doing nothing should not win');
});

test('end turn is ignored while the rivals are moving and after the game is over', async () => {
  const g = createGame({ seed: 5 });
  g.start({ size: 9, rivals: 1 });
  const first = g.call('endTurn');
  const second = g.call('endTurn'); // a double-tap on the button
  await Promise.all([first, second]);
  assert.equal(g.G.turn, 2, 'the turn advanced exactly once');
  g.G.over = true;
  await g.call('endTurn');
  assert.equal(g.G.turn, 2);
});
