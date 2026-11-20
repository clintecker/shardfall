// The static tables every other system reads. If one of these drifts out of sync (a unit that
// needs a tech nobody can research, a culture with no terrain names) the game breaks in ways
// that only show up twenty turns in. Check them up front instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './helpers/sandbox.mjs';

const g = createGame();
const { CULTURES, UT, TECHS, BRANCHES, TNAME, HOME, LAYOUT, CITY_NAMES } = g.run(
  '({ CULTURES, UT, TECHS, BRANCHES, TNAME, HOME, LAYOUT, CITY_NAMES })'
);

test('there are four cultures with unique keys, colors and traits', () => {
  assert.equal(CULTURES.length, 4);
  for (const field of ['key', 'name', 'color', 'trait', 'tech'])
    assert.equal(new Set(CULTURES.map(c => c[field])).size, 4, `${field} must be unique`);
});

test('every culture starts with a tier-1 tech from a different branch', () => {
  for (const c of CULTURES) {
    assert.ok(TECHS[c.tech], `${c.key} starts with unknown tech ${c.tech}`);
    assert.equal(TECHS[c.tech].tier, 1);
  }
  assert.equal(new Set(CULTURES.map(c => TECHS[c.tech].br)).size, 4);
});

test('every culture has a homeland and a name for each of the four terrains', () => {
  for (const c of CULTURES) {
    assert.equal(TNAME[c.key].length, 4);
    assert.equal(HOME[c.key].length, 2);
  }
});

test('the tech tree is four branches of three tiers, each requiring the tier below', () => {
  assert.equal(Object.keys(TECHS).length, 12);
  assert.equal(BRANCHES.length, 4);
  for (const [key, t] of Object.entries(TECHS)) {
    assert.ok(t.br >= 0 && t.br < 4, key);
    if (t.tier === 1) assert.equal(t.req, undefined, `${key} is tier 1 and needs nothing`);
    else {
      const req = TECHS[t.req];
      assert.ok(req, `${key} requires unknown tech ${t.req}`);
      assert.equal(req.tier, t.tier - 1, `${key} must require the tier below`);
      assert.equal(req.br, t.br, `${key} must require a tech from its own branch`);
    }
  }
  for (let br = 0; br < 4; br++)
    assert.deepEqual(
      Object.values(TECHS)
        .filter(t => t.br === br)
        .map(t => t.tier)
        .sort(),
      [1, 2, 3]
    );
});

test('every unit is unlocked by a real tech, and exactly one needs none', () => {
  const free = Object.values(UT).filter(u => !u.tech);
  assert.deepEqual(
    free.map(u => u.name),
    ['Trooper']
  );
  for (const [key, u] of Object.entries(UT)) {
    if (u.tech) assert.ok(TECHS[u.tech], `${key} needs unknown tech ${u.tech}`);
    assert.ok(u.hp > 0 && u.cost >= 2 && u.mov >= 1 && u.rng >= 1 && u.atk >= 1 && u.def >= 0, key);
  }
});

test('there are enough city names for the largest board', () => {
  // 13x13 board: 4 capitals + round(169 / 15) outposts
  assert.ok(CITY_NAMES.length >= 4 + Math.round((13 * 13) / 15));
  assert.equal(new Set(CITY_NAMES).size, CITY_NAMES.length);
});

test('every terrain layout is [water level, ridge level, grove chance]', () => {
  assert.deepEqual(Object.keys(LAYOUT).sort(), ['balanced', 'highlands', 'islands', 'wilds']);
  for (const [k, v] of Object.entries(LAYOUT)) {
    assert.equal(v.length, 3, k);
    assert.ok(v[0] < v[1], `${k}: water threshold must sit below the ridge threshold`);
    assert.ok(v[2] > 0 && v[2] < 1, k);
  }
});
