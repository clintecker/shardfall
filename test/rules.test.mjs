// The rules of the game, one at a time, on a blank board. These double as executable
// documentation: every number in docs/GAMEPLAY.md is pinned by a test in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './helpers/sandbox.mjs';

const GROVE = 1,
  RIDGE = 2,
  WATER = 3;
const HELION = 0,
  VERDANT = 1,
  CHOIR = 2,
  TIDE = 3;

function arena(n) {
  const g = createGame();
  g.arena(n);
  return g;
}
const keys = map => [...map.values()].map(([x, y]) => `${x},${y}`).sort();

/* ---------- combat ---------- */

test('damage: attack x health x 6 / (1 + defense x cover), rounded, never below 1', () => {
  const g = arena();
  const a = g.unit(HELION, 'trooper', 4, 4);
  const d = g.unit(VERDANT, 'trooper', 5, 4);
  assert.equal(
    g.call('dmgCalc', a, d, false),
    4,
    'trooper on trooper in the open: 2*1*6/(1+2) = 4'
  );
  assert.equal(g.call('dmgCalc', a, d, true), 3, 'a counter-attack hits at 75%: 3');

  a.hp = 5;
  assert.equal(g.call('dmgCalc', a, d, false), 3, 'at half health an attacker hits at 75%');
  a.hp = 10;

  g.tile(5, 4).t = GROVE;
  assert.equal(g.call('dmgCalc', a, d, false), 3, 'grove cover x1.25: 12/3.5 = 3.4 -> 3');
  g.tile(5, 4).t = RIDGE;
  assert.equal(g.call('dmgCalc', a, d, false), 3, 'ridge cover x1.5: 12/4 = 3');

  const wall = g.unit(VERDANT, 'bulwark', 4, 5);
  const poke = g.unit(HELION, 'bulwark', 3, 5, { hp: 1 });
  g.tile(4, 5).t = RIDGE;
  assert.equal(g.call('dmgCalc', poke, wall, false), 1, 'damage never rounds down to nothing');
});

test('a unit standing in its own city defends at x1.5, whatever the terrain', () => {
  const g = arena();
  const a = g.unit(HELION, 'mech', 6, 6);
  const d = g.unit(VERDANT, 'trooper', 7, 7); // Verdant capital on the 9x9 arena
  assert.equal(g.call('defBonus', d), 1.5);
  assert.equal(g.call('dmgCalc', a, d, false), 6, 'mech: 4*6/(1+2*1.5) = 6');
  const squatter = g.unit(HELION, 'trooper', 1, 7); // Tidewright capital, not Helion's
  assert.equal(g.call('defBonus', squatter), 1, "someone else's city is no cover");
});

test('attacking draws a counter-attack only from a defender that can reach back', () => {
  const g = arena();
  const melee = g.unit(HELION, 'trooper', 4, 4);
  const victim = g.unit(VERDANT, 'trooper', 5, 4);
  g.call('attack', melee, victim);
  assert.equal(victim.hp, 6);
  assert.equal(melee.hp, 8, 'the defender counters AFTER taking the hit, at 6/10 health: 2');
  assert.ok(melee.attacked && melee.moved, 'attacking ends the unit’s turn');

  const sniper = g.unit(HELION, 'railgunner', 4, 6);
  const target = g.unit(VERDANT, 'trooper', 6, 6);
  g.call('attack', sniper, target);
  assert.equal(target.hp, 6);
  assert.equal(sniper.hp, 8, 'a range-1 defender cannot answer a range-2 shot');
});

test('a melee kill advances into the tile; a ranged kill stays put', () => {
  const g = arena();
  const a = g.unit(HELION, 'mech', 4, 4);
  const d = g.unit(VERDANT, 'trooper', 5, 5, { hp: 2 });
  g.call('attack', a, d);
  assert.ok(!g.G.units.includes(d), 'defender is gone');
  assert.deepEqual([a.x, a.y], [5, 5]);
  assert.equal(g.G.factions[HELION].kills, 1);
  assert.equal(a.hp, 16, 'the dead do not counter-attack');

  const gun = g.unit(HELION, 'cannon', 1, 4);
  const far = g.unit(VERDANT, 'trooper', 4, 4, { hp: 1 });
  g.call('attack', gun, far);
  assert.deepEqual([gun.x, gun.y], [1, 4]);
});

test('a melee kill does not advance onto terrain the attacker cannot enter', () => {
  const g = arena();
  g.tile(5, 4).t = RIDGE;
  const a = g.unit(HELION, 'mech', 4, 4);
  const d = g.unit(VERDANT, 'trooper', 5, 4, { hp: 1 });
  g.call('attack', a, d);
  assert.deepEqual([a.x, a.y], [4, 4]);
});

test('range is measured in king moves (Chebyshev distance), diagonals included', () => {
  const g = arena();
  const cannon = g.unit(HELION, 'cannon', 4, 4);
  g.unit(VERDANT, 'trooper', 7, 7); // distance 3: in range
  g.unit(VERDANT, 'trooper', 8, 4); // distance 4: out
  const t = g.call('targets', cannon);
  assert.equal(t.length, 1);
  assert.deepEqual([t[0].x, t[0].y], [7, 7]);
});

test('you cannot target what you have not explored', () => {
  const g = arena();
  const gun = g.unit(HELION, 'railgunner', 4, 4);
  g.unit(VERDANT, 'trooper', 6, 4);
  g.G.factions[HELION].explored[g.call('idx', 6, 4)] = 0;
  assert.equal(g.call('targets', gun).length, 0);
});

/* ---------- movement ---------- */

test('a move-1 unit reaches the eight tiles around it, minus occupied ones', () => {
  const g = arena();
  const u = g.unit(HELION, 'trooper', 4, 4);
  g.unit(HELION, 'trooper', 5, 4);
  g.unit(VERDANT, 'trooper', 3, 3);
  assert.equal(g.call('reachable', u).size, 6);
});

test('rough ground ends a move: a Skimmer enters a grove but goes no further', () => {
  const g = arena();
  const u = g.unit(HELION, 'skimmer', 4, 4);
  assert.equal(g.call('reachable', u).size, 24, 'two king moves over open ground: a 5x5 block');
  for (const y of [3, 4, 5]) g.tile(5, y).t = GROVE; // a wall of groves to the east
  const r = keys(g.call('reachable', u));
  assert.ok(r.includes('5,4'), 'can step into the grove');
  assert.ok(!r.includes('6,4'), 'cannot pass through it in the same turn');
});

test('ridges need Grav Rigs; liquid needs Hover Drives, unless you are a Tidewright', () => {
  const g = arena();
  g.tile(5, 4).t = RIDGE;
  g.tile(3, 4).t = WATER;
  const u = g.unit(HELION, 'trooper', 4, 4);
  assert.ok(!keys(g.call('reachable', u)).includes('5,4'));
  assert.ok(!keys(g.call('reachable', u)).includes('3,4'));

  g.G.factions[HELION].techs.grav = 1;
  assert.ok(keys(g.call('reachable', u)).includes('5,4'));
  g.G.factions[HELION].techs.hover = 1;
  assert.ok(keys(g.call('reachable', u)).includes('3,4'));

  const t = g.unit(TIDE, 'trooper', 2, 5);
  assert.ok(keys(g.call('reachable', t)).includes('3,4'), 'Tideborn: no tech needed');
});

test('units reveal the tiles around them; ridges and Recon Satellites extend sight', () => {
  const g = arena(11);
  const f = g.G.factions[HELION];
  const lit = () => f.explored.reduce((a, b) => a + b, 0);
  const reset = () => f.explored.fill(0);
  const u = g.unit(HELION, 'trooper', 5, 5);

  reset();
  g.call('revealUnit', u);
  assert.equal(lit(), 9, 'radius 1');

  g.tile(5, 5).t = RIDGE;
  reset();
  g.call('revealUnit', u);
  assert.equal(lit(), 25, 'radius 2 from a ridge');

  f.techs.recon = 1;
  reset();
  g.call('revealUnit', u);
  assert.equal(lit(), 49, 'radius 3 from a ridge with Recon Satellites');
});

/* ---------- cities ---------- */

test('a city is captured by a unit that began its turn standing on it', () => {
  const g = arena();
  const u = g.unit(HELION, 'trooper', 6, 6);
  g.call('moveUnit', u, 7, 7); // walk onto the Verdant capital
  assert.equal(g.call('canCapture', u), false, 'not on the turn you arrive');
  g.call('startTurn', HELION);
  assert.equal(g.call('canCapture', u), true);
  g.call('capture', u);
  assert.equal(g.call('cityAt', 7, 7).owner, HELION);
  assert.ok(u.moved && u.attacked, 'capturing uses the whole turn');
});

test('losing your last city eliminates you and removes your army', () => {
  const g = arena();
  const u = g.unit(HELION, 'trooper', 7, 7);
  g.unit(VERDANT, 'mech', 4, 4);
  g.call('capture', u);
  assert.equal(g.G.factions[VERDANT].alive, false);
  assert.equal(g.G.units.filter(x => x.owner === VERDANT).length, 0);
  assert.equal(g.G.over, false, 'two rivals are still standing');
  assert.equal(g.call('score', VERDANT), 0, 'the fallen score nothing');
});

test('the game ends the moment you hold every rival city, or lose your own', () => {
  const g = arena();
  for (const [x, y] of [
    [7, 7],
    [7, 1],
    [1, 7]
  ])
    g.call('capture', g.unit(HELION, 'trooper', x, y));
  assert.equal(g.G.over, true);
  assert.equal(g.G.winner, HELION);

  const h = arena();
  h.call('capture', h.unit(CHOIR, 'trooper', 1, 1));
  assert.equal(h.G.over, true);
  assert.notEqual(h.G.winner, HELION);
});

/* ---------- economy ---------- */

test('income: city level, +1 for a capital, +2 more for a Helion capital', () => {
  const g = arena();
  assert.equal(g.call('income', HELION), 4, 'level 1 + capital 1 + Dividend 2');
  assert.equal(g.call('income', VERDANT), 2);
  g.call('placeCity', 4, 4, VERDANT, false, 'Outpost');
  assert.equal(g.call('income', VERDANT), 3, 'an outpost pays its level');
  g.call('cityAt', 4, 4).level = 3;
  assert.equal(g.call('income', VERDANT), 5);
});

test('research costs tier x (3 + cities you own) and needs the tech below it', () => {
  const g = arena();
  const f = g.G.factions[VERDANT];
  assert.equal(g.call('techCost', VERDANT, 'hydroponics'), 4);
  assert.equal(g.call('techCost', VERDANT, 'nanomed'), 12);
  g.call('placeCity', 4, 4, VERDANT, false, 'Outpost');
  assert.equal(g.call('techCost', VERDANT, 'nanomed'), 15, 'every city makes research dearer');

  assert.equal(g.call('research', VERDANT, 'grove'), false, 'needs Hydroponics first');
  assert.equal(g.call('research', VERDANT, 'hydroponics'), true);
  assert.equal(f.flux, 45);
  assert.equal(g.call('research', VERDANT, 'hydroponics'), false, 'cannot buy a tech twice');
  f.flux = 9;
  assert.equal(g.call('research', VERDANT, 'grove'), false, 'cannot afford 10');
});

test('units cost their price; the Null Choir pays 1 less, never below 2', () => {
  const g = arena();
  assert.equal(g.call('unitCost', HELION, 'mech'), 6);
  assert.equal(g.call('unitCost', CHOIR, 'mech'), 5);
  assert.equal(g.call('unitCost', CHOIR, 'trooper'), 2);
});

test('training needs the tech, the flux, an empty city and spare supply', () => {
  const g = arena();
  const f = g.G.factions[HELION];
  const city = g.call('cityAt', 1, 1);
  assert.equal(g.call('train', HELION, city, 'mech'), false, 'no Mechworks');
  assert.equal(g.call('train', HELION, city, 'trooper'), true);
  assert.equal(f.flux, 48);
  const fresh = g.call('unitAt', 1, 1);
  assert.ok(fresh.moved && fresh.attacked, 'new units cannot act until next turn');
  assert.equal(g.call('train', HELION, city, 'trooper'), false, 'the city tile is occupied');

  // supply = 1 + sum(city level + 1) = 3 for one level-1 city
  assert.equal(g.call('supply', HELION), 3);
  fresh.x = 3;
  g.unit(HELION, 'trooper', 4, 4);
  g.unit(HELION, 'trooper', 5, 5);
  assert.equal(g.call('armySize', HELION), 3);
  assert.equal(g.call('train', HELION, city, 'trooper'), false, 'army is at its supply cap');
  city.level = 2;
  assert.equal(g.call('train', HELION, city, 'trooper'), true, 'a bigger city supplies one more');
});

test('harvesting needs the right tech, the flux, and a tile inside your borders', () => {
  const g = arena();
  const f = g.G.factions[HELION];
  const city = g.call('cityAt', 1, 1);
  g.tile(2, 2).res = 'ore';
  g.tile(0, 1).res = 'algae';
  g.tile(2, 1).t = GROVE;
  g.tile(5, 5).res = 'ore'; // nobody's land

  assert.equal(g.call('harvest', HELION, 2, 2), false, 'no Excavation yet');
  f.techs.excavation = f.techs.hydroponics = f.techs.grove = 1;
  assert.equal(g.call('harvest', HELION, 5, 5), false, 'outside your borders');
  assert.equal(g.call('harvest', VERDANT, 2, 2), false, "inside someone else's");

  f.flux = 9;
  assert.equal(g.call('harvest', HELION, 2, 2), true, 'ore: 4 flux for +2 population');
  assert.equal(city.level, 2, '2 population fills a level-1 city');
  assert.equal(f.flux, 9 - 4 + 2, 'levelling up pays 2 flux back');
  assert.equal(g.tile(2, 2).res, null, 'a seam is mined once');

  assert.equal(g.call('harvest', HELION, 0, 1), true, 'algae: 2 flux for +1');
  assert.equal(g.call('harvest', HELION, 2, 1), true, 'grove: 3 flux for +1');
  assert.equal(
    g.call('harvest', HELION, 2, 1),
    false,
    'a grove is harvested once but stays a grove'
  );
  assert.equal(g.tile(2, 1).t, GROVE);
  assert.equal(city.pop, 2);
});

test('a city needs level + 1 population to grow, and level 3 widens its borders', () => {
  const g = arena();
  const city = g.call('cityAt', 1, 1);
  const owned = () => g.G.tiles.filter(t => t.o === city.id).length;
  assert.equal(owned(), 9, 'a new city claims the 3x3 around it');
  g.call('addPop', city, 2);
  assert.equal(city.level, 2);
  assert.equal(owned(), 9);
  g.call('addPop', city, 2);
  assert.equal(city.level, 2, 'level 2 needs 3');
  g.call('addPop', city, 1);
  assert.equal(city.level, 3);
  assert.equal(owned(), 16, 'radius 2, clipped by the board edge: 4x4 from the corner');
});

test('borders never steal tiles another city already claimed', () => {
  const g = arena();
  g.call('placeCity', 3, 3, VERDANT, false, 'Neighbor');
  const mine = g.call('cityAt', 1, 1);
  const before = g.G.tiles.filter(t => t.o === g.call('cityAt', 3, 3).id).length;
  g.call('claim', mine, 2);
  assert.equal(g.G.tiles.filter(t => t.o === g.call('cityAt', 3, 3).id).length, before);
});

/* ---------- turns ---------- */

test('resting heals 2, or 4 inside your borders; Nanomedics doubles it', () => {
  const g = arena();
  const f = g.G.factions[HELION];
  const out = g.unit(HELION, 'mech', 4, 4, { hp: 1 });
  const home = g.unit(HELION, 'mech', 2, 2, { hp: 1 });
  const busy = g.unit(HELION, 'mech', 5, 5, { hp: 1, moved: true });
  g.call('finishTurn', HELION);
  assert.deepEqual([out.hp, home.hp, busy.hp], [3, 5, 1]);
  f.techs.nanomed = 1;
  g.call('finishTurn', HELION);
  assert.deepEqual([out.hp, home.hp, busy.hp], [7, 13, 1]);
  g.call('finishTurn', HELION);
  assert.equal(home.hp, 16, 'healing stops at full health');
});

test('Verdant units mend 2 every turn, even after acting', () => {
  const g = arena();
  const fought = g.unit(VERDANT, 'trooper', 4, 4, { hp: 3, moved: true, attacked: true });
  const rested = g.unit(VERDANT, 'trooper', 5, 5, { hp: 3 });
  g.call('finishTurn', VERDANT);
  assert.deepEqual([fought.hp, rested.hp], [5, 7]);
});

test('starting a turn pays income and readies every unit', () => {
  const g = arena();
  const u = g.unit(HELION, 'trooper', 4, 4, { moved: true, attacked: true });
  g.call('startTurn', HELION);
  assert.equal(g.G.factions[HELION].flux, 54);
  assert.ok(!u.moved && !u.attacked);
});

test('score: 100 + 40/level per city, 30 per tech, 10 per unit, 15 per kill, 2 per explored tile', () => {
  const g = arena();
  const f = g.G.factions[HELION];
  f.explored.fill(0);
  assert.equal(g.call('score', HELION), 140);
  f.techs.excavation = 1;
  f.kills = 2;
  g.unit(HELION, 'trooper', 4, 4); // reveals 9 tiles
  assert.equal(g.call('score', HELION), 140 + 30 + 30 + 10 + 18);
});

/* ---------- player input ---------- */

test('a move that reveals nothing can be undone; one that lifts fog cannot', () => {
  const g = arena(11);
  const f = g.G.factions[HELION];
  const u = g.unit(HELION, 'trooper', 5, 5);
  g.call('setSel', { kind: 'unit', id: u.id });
  g.call('clickTile', 6, 5);
  assert.deepEqual([u.x, u.y, u.moved], [6, 5, true]);
  assert.ok(g.run('UNDO'), 'the whole board was already explored');
  g.call('act', 'undo');
  assert.deepEqual([u.x, u.y, u.moved], [5, 5, false]);

  f.explored[g.call('idx', 7, 5)] = 0;
  g.call('setSel', { kind: 'unit', id: u.id });
  g.call('clickTile', 6, 5);
  assert.equal(g.run('UNDO'), null, 'new ground was seen, so the move is final');
});

test('clicking a red target attacks it; clicking elsewhere selects what is there', () => {
  const g = arena();
  const u = g.unit(HELION, 'trooper', 4, 4);
  const e = g.unit(VERDANT, 'trooper', 5, 4);
  g.call('clickTile', 4, 4);
  assert.equal(g.run('sel.kind'), 'unit');
  assert.equal(g.run('atks.length'), 1);
  g.call('clickTile', 5, 4);
  assert.equal(e.hp, 6);
  g.call('clickTile', 1, 1);
  assert.equal(g.run('sel.kind'), 'city');
  g.call('clickTile', 4, 6);
  assert.equal(g.run('sel.kind'), 'tile');
});
