// Map generation. Every board, whatever the size, layout or dice, has to be winnable and fair:
// each side gets the same starter kit next to its capital and a walkable road to the middle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './helpers/sandbox.mjs';

const PLAIN = 0,
  GROVE = 1,
  RIDGE = 2,
  WATER = 3;
const SIZES = [9, 11, 13];
const LAYOUTS = ['balanced', 'islands', 'highlands', 'wilds'];

/** Runs `fn` over a spread of generated boards: 3 sizes x 4 layouts x 1-3 rivals x 3 seeds. */
function eachBoard(fn) {
  let seed = 1;
  for (const size of SIZES)
    for (const layout of LAYOUTS)
      for (const rivals of [1, 2, 3])
        for (let k = 0; k < 3; k++) {
          const g = createGame({ seed: seed++ });
          const G = g.start({ size, layout, rivals, culture: 'choir' });
          fn(G, g, `${size}x${size} ${layout}, ${rivals} rivals, seed ${seed - 1}`);
        }
}

test('a new game has the board, sides and starting kit the setup screen promised', () => {
  eachBoard((G, g, label) => {
    const rivals = G.factions.length - 1;
    assert.equal(G.tiles.length, G.N * G.N, label);
    assert.equal(G.turn, 1);
    assert.equal(G.maxTurns, 30);
    assert.equal(G.factions[0].key, 'choir', 'the player is always side 0');
    assert.equal(new Set(G.factions.map(f => f.key)).size, rivals + 1, 'no culture appears twice');
    for (const f of G.factions) {
      assert.equal(f.flux, 5, label);
      assert.equal(Object.keys(f.techs).length, 1, 'one starting tech');
      const cap = G.cities[f.i];
      assert.ok(cap.capital && cap.owner === f.i && cap.level === 1, label);
      const army = G.units.filter(u => u.owner === f.i);
      assert.equal(army.length, 1, label);
      assert.equal(army[0].type, 'trooper');
      assert.deepEqual([army[0].x, army[0].y], [cap.x, cap.y]);
      assert.ok(!army[0].moved, 'the first trooper can act on turn 1');
    }
  });
});

test('every capital gets a starter kit next door: one ore ridge, two algae beds, a grove, no liquid', () => {
  eachBoard((G, g, label) => {
    for (const f of G.factions) {
      const cap = G.cities[f.i];
      const around = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (dx || dy) around.push(G.tiles[(cap.y + dy) * G.N + cap.x + dx]);
      assert.equal(around.length, 8, 'capitals sit one tile in from the corner');
      assert.equal(around.filter(t => t.t === RIDGE && t.res === 'ore').length, 1, label);
      assert.equal(around.filter(t => t.t === RIDGE).length, 1, `${label}: exactly one ridge`);
      assert.ok(around.filter(t => t.res === 'algae').length >= 2, `${label}: two algae beds`);
      assert.ok(around.filter(t => t.t === GROVE).length >= 1, `${label}: a grove`);
      assert.equal(around.filter(t => t.t === WATER).length, 0, `${label}: no liquid`);
    }
  });
});

test('a trooper with no upgrades can walk from every capital to the middle of the board', () => {
  eachBoard((G, g, label) => {
    const mid = G.N >> 1;
    for (const f of G.factions) {
      const cap = G.cities[f.i];
      const noTech = { key: 'helion', techs: {} };
      const dist = g.call('distMap', noTech, cap.x, cap.y);
      assert.ok(dist[mid * G.N + mid] < 99, `${label}: side ${f.i} is walled in`);
    }
  });
});

test('outposts are neutral, spaced at least 3 tiles apart, and sit on open ground', () => {
  eachBoard((G, g, label) => {
    const outposts = G.cities.filter(c => c.owner < 0);
    assert.ok(outposts.length >= 2, `${label}: only ${outposts.length} outposts`);
    assert.ok(outposts.length <= Math.round((G.N * G.N) / 15), label);
    for (const c of G.cities) {
      const t = G.tiles[c.y * G.N + c.x];
      assert.equal(t.t, PLAIN, label);
      assert.equal(t.res, null, label);
      assert.equal(t.c, c.id, 'the tile points back at its city');
      for (const d of G.cities)
        if (c !== d)
          assert.ok(
            Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y)) >= 3,
            `${label}: crowded cities`
          );
    }
    assert.equal(new Set(G.cities.map(c => c.name)).size, G.cities.length, 'unique names');
  });
});

test('resources only spawn where they make sense: algae on flats, ore on ridges', () => {
  eachBoard((G, g, label) => {
    for (const t of G.tiles) {
      if (t.res === 'algae') assert.equal(t.t, PLAIN, label);
      if (t.res === 'ore') assert.equal(t.t, RIDGE, label);
      assert.ok([PLAIN, GROVE, RIDGE, WATER].includes(t.t));
    }
  });
});

test('every tile belongs to the homeland of exactly one side, and capitals sit in their own', () => {
  eachBoard((G, g, label) => {
    for (const t of G.tiles) assert.ok(t.b >= 0 && t.b < G.factions.length, label);
    for (const f of G.factions) {
      const cap = G.cities[f.i];
      assert.equal(G.tiles[cap.y * G.N + cap.x].b, f.i, `${label}: side ${f.i} capital biome`);
    }
  });
});

test('you start knowing the land around your capital and nothing else', () => {
  eachBoard((G, g, label) => {
    for (const f of G.factions) {
      const cap = G.cities[f.i];
      const lit = f.explored.reduce((a, b) => a + b, 0);
      assert.equal(lit, 16, `${label}: a 5x5 reveal clipped to 4x4 by the corner`);
      assert.equal(f.explored[cap.y * G.N + cap.x], 1);
    }
  });
});

test('the terrain presets actually change the terrain', () => {
  const share = (layout, kind) => {
    let hit = 0,
      all = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const G = createGame({ seed }).start({ size: 13, layout, rivals: 3 });
      hit += G.tiles.filter(t => t.t === kind).length;
      all += G.tiles.length;
    }
    return hit / all;
  };
  assert.ok(share('islands', WATER) > share('balanced', WATER) * 1.5, 'Archipelago is wetter');
  assert.ok(share('highlands', RIDGE) > share('balanced', RIDGE) * 1.5, 'Highlands are rockier');
  assert.ok(share('wilds', GROVE) > share('balanced', GROVE) * 1.5, 'Wildwood is leafier');
});

test('the sky is the one you picked, or one of the five when left to chance', () => {
  const skies = ['storm', 'dusk', 'aurora', 'eclipse', 'dawn'];
  assert.equal(createGame().start({ atmo: 'eclipse' }).atmo, 'eclipse');
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++)
    seen.add(createGame({ seed }).start({ atmo: 'random' }).atmo);
  assert.deepEqual([...seen].sort(), [...skies].sort());
});

test('the whole game state survives a JSON round trip (that is the save format)', () => {
  const G = createGame({ seed: 7 }).start({ size: 13, rivals: 3 });
  assert.deepEqual(
    JSON.parse(JSON.stringify(G)),
    JSON.parse(JSON.stringify(JSON.parse(JSON.stringify(G))))
  );
  const walk = (v, p) => {
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `${p} is not finite`);
      return;
    }
    assert.equal(typeof v, 'object', `${p} is a ${typeof v}, which JSON would drop`);
    for (const k of Object.keys(v)) walk(v[k], `${p}.${k}`);
  };
  walk(G, 'G');
});
