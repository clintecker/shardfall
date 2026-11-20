'use strict';
/*
 * World generation: turns the setup choices into a fresh game state.
 *
 * newGame() rolls the terrain from layered sine noise, puts a capital in each corner with the
 * same starter kit next door, carves each side a walkable road to the middle, scatters neutral
 * outposts, and splits the board into homelands (one biome per culture). Also the low-level
 * verbs the rules build on: placeCity, claim (borders), reveal (fog of war), spawn.
 */
function newGame(key, N, rivals) {
  const LY = LAYOUT[pick.layout] || LAYOUT.balanced,
    AK = ['storm', 'dusk', 'aurora', 'eclipse', 'dawn'];
  const me = CULTURES.find(c => c.key === key);
  const order = [me, ...shuffle(CULTURES.filter(c => c !== me)).slice(0, rivals)];
  G = {
    N,
    turn: 1,
    maxTurns: 30,
    uid: 1,
    over: false,
    winner: -1,
    log: [],
    tiles: [],
    cities: [],
    units: [],
    factions: order.map((c, i) => ({
      i,
      key: c.key,
      flux: 5,
      techs: { [c.tech]: 1 },
      alive: true,
      kills: 0,
      explored: new Array(N * N).fill(0),
      pref: shuffle(Object.keys(TECHS)).sort((a, b) => TECHS[a].tier - TECHS[b].tier)
    }))
  };
  const ph = Array.from({ length: 8 }, () => Math.random() * 6.28);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const h =
        Math.sin(x * 0.9 + ph[0]) +
        Math.sin(y * 0.8 + ph[1]) +
        Math.sin((x + y) * 0.5 + ph[2]) +
        (Math.random() - 0.5) * 1.4;
      const m =
        Math.sin(x * 0.7 + ph[3]) +
        Math.sin(y * 0.95 + ph[4]) +
        Math.sin((x - y) * 0.6 + ph[5]) +
        (Math.random() - 0.5) * 1.4;
      let t = h < LY[0] ? WATER : m > LY[1] ? RIDGE : Math.random() < LY[2] ? GROVE : PLAIN,
        res = null;
      if (t === PLAIN && Math.random() < 0.2) res = 'algae';
      if (t === RIDGE && Math.random() < 0.5) res = 'ore';
      G.tiles.push({ t, res, o: -1, c: -1, used: 0 });
    }
  const names = shuffle(CITY_NAMES.slice());
  let spots = [
    [1, 1],
    [N - 2, N - 2],
    [N - 2, 1],
    [1, N - 2]
  ];
  if (Math.random() < 0.5) spots = spots.map(([x, y]) => [N - 1 - x, y]);
  if (Math.random() < 0.5) spots = spots.map(([x, y]) => [y, x]);
  const mid = N >> 1;
  G.factions.forEach((f, i) => {
    const [x, y] = spots[i];
    placeCity(x, y, i, true, names.pop());
    // Starter kit: the eight neighbors, in random order, become one ore ridge, two algae beds
    // and a grove; the rest are cleared of anything a Trooper cannot walk on.
    const dirs = shuffle(DIRS.slice());
    // The first step of the road to the middle (carved below) must not be the ridge, or the
    // road would flatten it and this side would start without ore. Trade it for a spare tile.
    const road = dirs.findIndex(
      ([dx, dy]) => dx === Math.sign(mid - x) && dy === Math.sign(mid - y)
    );
    if (road === 0) [dirs[0], dirs[7]] = [dirs[7], dirs[0]];
    const nb = dirs.map(([dx, dy]) => G.tiles[idx(x + dx, y + dy)]);
    nb.forEach((t, j) => {
      if (j === 0) {
        t.t = RIDGE;
        t.res = 'ore';
      } else if (j < 3) {
        t.t = PLAIN;
        t.res = 'algae';
      } else if (j === 3) {
        t.t = GROVE;
        t.res = null;
      } else if (t.t === WATER || t.t === RIDGE) {
        t.t = PLAIN;
        t.res = null;
      }
    });
    // Carve a walkable diagonal from the capital to the middle so nobody starts walled in.
    let cx = x,
      cy = y;
    while (cx !== mid || cy !== mid) {
      cx += Math.sign(mid - cx);
      cy += Math.sign(mid - cy);
      const t = G.tiles[idx(cx, cy)];
      if (t.t === WATER || t.t === RIDGE) {
        t.t = PLAIN;
        t.res = null;
      }
    }
    spawn(i, 'trooper', x, y, false);
  });
  const want = Math.round((N * N) / 15);
  let tries = 0,
    made = 0;
  while (made < want && tries++ < 600) {
    const x = (Math.random() * N) | 0,
      y = (Math.random() * N) | 0;
    if (G.cities.some(c => cheb(c.x, c.y, x, y) < 3)) continue;
    placeCity(x, y, -1, false, names.pop() || 'Outpost');
    made++;
  }
  assignBiomes();
  G.atmo = pick.atmo === 'random' ? AK[(Math.random() * AK.length) | 0] : pick.atmo;
  G.layout = pick.layout;
  G.cities.forEach(c => {
    if (c.owner >= 0) revealAround(c.owner, c.x, c.y, 2);
  });
  log('Your scouts report silence. Find the outposts before your rivals do.');
}
function assignBiomes() {
  const s = G.bseed || (G.bseed = 1 + Math.random() * 9);
  G.tiles.forEach((t, k) => {
    const x = k % G.N,
      y = (k / G.N) | 0;
    let best = 0,
      bd = 1e9;
    G.factions.forEach((f, i) => {
      const c = G.cities[i],
        d =
          Math.hypot(c.x - x, c.y - y) +
          Math.sin(x * 0.9 + s * (i + 1)) * 1.1 +
          Math.sin(y * 1.1 + s * 1.7 * (i + 1)) * 1.1;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    t.b = best;
  });
}
function placeCity(x, y, owner, capital, name) {
  const t = G.tiles[idx(x, y)];
  t.t = PLAIN;
  t.res = null;
  const c = { id: G.cities.length, x, y, owner, capital, name, level: 1, pop: 0 };
  G.cities.push(c);
  t.c = c.id;
  claim(c, 1);
}
function claim(c, r) {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = c.x + dx,
        y = c.y + dy;
      if (inb(x, y)) {
        const t = G.tiles[idx(x, y)];
        if (t.o < 0) t.o = c.id;
      }
    }
  if (c.owner >= 0) revealAround(c.owner, c.x, c.y, r + 1);
}
function revealAround(f, x, y, r) {
  const e = G.factions[f].explored;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) if (inb(x + dx, y + dy)) e[idx(x + dx, y + dy)] = 1;
}
function revealUnit(u) {
  const f = G.factions[u.owner];
  revealAround(
    u.owner,
    u.x,
    u.y,
    1 + (G.tiles[idx(u.x, u.y)].t === RIDGE ? 1 : 0) + (f.techs.recon ? 1 : 0)
  );
}
function spawn(owner, type, x, y, tired) {
  const u = { id: G.uid++, owner, type, x, y, hp: UT[type].hp, moved: tired, attacked: tired };
  G.units.push(u);
  revealUnit(u);
  return u;
}
