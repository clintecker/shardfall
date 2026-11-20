'use strict';
/*
 * The rules. Pure game logic: every function reads and mutates G and nothing else.
 *
 * Economy (income, score, supply, costs), movement (canEnter, reachable), combat (targets,
 * defBonus, dmgCalc, attack), cities (capture, addPop, harvest, train), research, and the turn
 * cycle (startTurn, finishTurn, checkOver).
 *
 * Side effects for the screen are queued, not drawn: attack() and friends push small records
 * onto `fx` and call mark(); the renderer picks those up on the next frame. That is what lets
 * these rules run headlessly in the tests. docs/GAMEPLAY.md explains every formula.
 */
function income(i) {
  const k = G.factions[i].key;
  return G.cities.reduce(
    (s, c) =>
      c.owner === i ? s + c.level + (c.capital ? 1 : 0) + (c.capital && k === 'helion' ? 2 : 0) : s,
    0
  );
}
function score(i) {
  const f = G.factions[i];
  if (!f.alive) return 0;
  let s = 0;
  G.cities.forEach(c => {
    if (c.owner === i) s += 100 + 40 * c.level;
  });
  s +=
    Object.keys(f.techs).length * 30 +
    G.units.filter(u => u.owner === i).length * 10 +
    f.kills * 15 +
    f.explored.reduce((a, b) => a + b, 0) * 2;
  return s;
}
const supply = i => G.cities.reduce((s, c) => (c.owner === i ? s + c.level + 1 : s), 1);
const armySize = i => G.units.filter(u => u.owner === i).length;
const techCost = (i, k) => TECHS[k].tier * (3 + nCities(i));
const unitCost = (i, t) =>
  G.factions[i].key === 'choir' ? Math.max(2, UT[t].cost - 1) : UT[t].cost;
function canEnter(f, t) {
  if (t.t === RIDGE) return !!f.techs.grav;
  if (t.t === WATER) return !!f.techs.hover || f.key === 'tide';
  return true;
}
function reachable(u) {
  const f = G.factions[u.owner],
    out = new Map(),
    best = new Map([[idx(u.x, u.y), UT[u.type].mov]]),
    q = [[u.x, u.y, UT[u.type].mov]];
  while (q.length) {
    const [x, y, m] = q.shift();
    if (m <= 0) continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx,
        ny = y + dy;
      if (!inb(nx, ny)) continue;
      const k = idx(nx, ny),
        t = G.tiles[k];
      if (!canEnter(f, t) || unitAt(nx, ny)) continue;
      const left = t.t === PLAIN ? m - 1 : 0;
      if (best.has(k) && best.get(k) >= left) continue;
      best.set(k, left);
      out.set(k, [nx, ny]);
      q.push([nx, ny, left]);
    }
  }
  return out;
}
function targets(u, x = u.x, y = u.y) {
  const r = UT[u.type].rng,
    e = G.factions[0].explored;
  return G.units.filter(
    o => o.owner !== u.owner && cheb(o.x, o.y, x, y) <= r && (u.owner !== 0 || e[idx(o.x, o.y)])
  );
}
function defBonus(u) {
  const t = G.tiles[idx(u.x, u.y)];
  if (t.c >= 0 && G.cities[t.c].owner === u.owner) return 1.5;
  return t.t === RIDGE ? 1.5 : t.t === GROVE ? 1.25 : 1;
}
function dmgCalc(a, d, back) {
  const A = UT[a.type],
    D = UT[d.type];
  return Math.max(
    1,
    Math.round(
      (A.atk * (0.5 + (0.5 * a.hp) / A.hp) * (back ? 0.75 : 1) * 6) / (1 + D.def * defBonus(d))
    )
  );
}
function mark(id, o) {
  let p = pos.get(id);
  if (!p) {
    const u = G.units.find(u => u.id === id);
    if (!u) return;
    p = { x: u.x, y: u.y };
    pos.set(id, p);
  }
  Object.assign(p, o);
}
function addFx(x, y, text, color) {
  fx.push({ x, y, text, color, t: performance.now() });
}
function kill(d, by) {
  G.units = G.units.filter(u => u !== d);
  pos.delete(d.id);
  fx.push({ kind: 'burst', x: d.x, y: d.y, color: cult(d.owner).color, t: performance.now() });
  G.factions[by.owner].kills++;
  if (d.owner === 0) log(`Your ${UT[d.type].name} was destroyed by the ${cult(by.owner).name}.`);
  else if (by.owner === 0)
    log(`Your ${UT[by.type].name} destroyed a ${cult(d.owner).name} ${UT[d.type].name}.`);
}
function attack(a, d) {
  const dmg = dmgCalc(a, d, false);
  d.hp -= dmg;
  a.fx = d.x - a.x;
  a.fy = d.y - a.y;
  d.fx = -a.fx;
  d.fy = -a.fy;
  mark(a.id, { atkT: performance.now(), tx: d.x, ty: d.y });
  mark(d.id, { hitT: performance.now() });
  addFx(d.x, d.y, '-' + dmg, '#ff5d73');
  fx.push({
    kind: 'beam',
    x1: a.x,
    y1: a.y,
    x2: d.x,
    y2: d.y,
    color: cult(a.owner).color,
    t: performance.now()
  });
  a.attacked = a.moved = true;
  if (d.hp <= 0) {
    kill(d, a);
    if (UT[a.type].rng === 1 && canEnter(G.factions[a.owner], G.tiles[idx(d.x, d.y)])) {
      a.x = d.x;
      a.y = d.y;
      revealUnit(a);
    }
  } else if (cheb(a.x, a.y, d.x, d.y) <= UT[d.type].rng) {
    const r = dmgCalc(d, a, true);
    a.hp -= r;
    mark(a.id, { hitT: performance.now() + 120 });
    addFx(a.x, a.y, '-' + r, '#ffb347');
    if (a.hp <= 0) kill(a, d);
  }
}
function moveUnit(u, x, y) {
  u.fx = x - u.x;
  u.fy = y - u.y;
  u.x = x;
  u.y = y;
  u.moved = true;
  revealUnit(u);
}
function canCapture(u) {
  const c = cityAt(u.x, u.y);
  return !!c && c.owner !== u.owner && !u.moved && !u.attacked;
}
function capture(u) {
  const c = cityAt(u.x, u.y),
    prev = c.owner;
  c.owner = u.owner;
  u.moved = u.attacked = true;
  revealAround(u.owner, c.x, c.y, c.level >= 3 ? 3 : 2);
  addFx(c.x, c.y, 'Captured', cult(u.owner).color);
  fx.push({ kind: 'burst', x: c.x, y: c.y, color: cult(u.owner).color, t: performance.now() });
  log(`${u.owner === 0 ? 'You' : 'The ' + cult(u.owner).name} captured ${c.name}.`);
  if (u.owner === 0) showBanner('City captured', c.name);
  else if (prev === 0) showBanner('City lost', c.name, '#ff5d73');
  if (prev >= 0 && !G.cities.some(x => x.owner === prev)) {
    G.factions[prev].alive = false;
    G.units = G.units.filter(x => x.owner !== prev);
    log(`The ${cult(prev).name} ${prev === 0 ? '(you) have' : 'has'} fallen.`);
    if (prev !== 0) showBanner(cult(prev).name, 'Eliminated', cult(prev).color);
  }
  checkOver();
}
function addPop(c, n) {
  c.pop += n;
  while (c.pop >= c.level + 1) {
    c.pop -= c.level + 1;
    c.level++;
    G.factions[c.owner].flux += 2;
    if (c.level === 3) claim(c, 2);
    if (c.owner === 0)
      log(
        `${c.name} grew to level ${c.level}: +1 income, +2 flux${c.level === 3 ? ', wider borders' : ''}.`
      );
  }
}
function harvestInfo(i, x, y) {
  const t = G.tiles[idx(x, y)],
    f = G.factions[i];
  if (tileFaction(t) !== i) return null;
  if (t.res === 'algae') return { cost: 2, pop: 1, tech: 'hydroponics', what: 'algae bed' };
  if (t.res === 'ore') return { cost: 4, pop: 2, tech: 'excavation', what: 'ore seam' };
  if (t.t === GROVE && !t.used) return { cost: 3, pop: 1, tech: 'grove', what: 'grove' };
  return null;
}
function harvest(i, x, y) {
  const h = harvestInfo(i, x, y),
    f = G.factions[i],
    t = G.tiles[idx(x, y)];
  if (!h || !f.techs[h.tech] || f.flux < h.cost) return false;
  f.flux -= h.cost;
  t.res = null;
  t.used = 1;
  addPop(G.cities[t.o], h.pop);
  if (i === 0) addFx(x, y, '+' + h.pop + ' pop', '#5fe0a0');
  if (G.factions[0].explored[idx(x, y)]) {
    const c = G.cities[t.o];
    fx.push({
      kind: 'harvest',
      x,
      y,
      cx: c.x,
      cy: c.y,
      color: h.tech === 'excavation' ? '#ffb347' : h.tech === 'hydroponics' ? '#a8ff3e' : '#19ffd0',
      t: performance.now()
    });
  }
  return true;
}
function train(i, c, type) {
  const f = G.factions[i],
    cost = unitCost(i, type);
  if (
    f.flux < cost ||
    unitAt(c.x, c.y) ||
    armySize(i) >= supply(i) ||
    (UT[type].tech && !f.techs[UT[type].tech])
  )
    return false;
  f.flux -= cost;
  spawn(i, type, c.x, c.y, true);
  return true;
}
function research(i, k) {
  const f = G.factions[i],
    T = TECHS[k],
    cost = techCost(i, k);
  if (f.techs[k] || (T.req && !f.techs[T.req]) || f.flux < cost) return false;
  f.flux -= cost;
  f.techs[k] = 1;
  return true;
}
function startTurn(i) {
  G.factions[i].flux += income(i);
  G.units.forEach(u => {
    if (u.owner === i) u.moved = u.attacked = false;
  });
}
function finishTurn(i) {
  const f = G.factions[i];
  G.units.forEach(u => {
    if (u.owner !== i) return;
    let h = 0;
    if (!u.moved && !u.attacked)
      h = (2 + (tileFaction(G.tiles[idx(u.x, u.y)]) === i ? 2 : 0)) * (f.techs.nanomed ? 2 : 1);
    if (f.key === 'verdant') h += 2;
    u.hp = Math.min(UT[u.type].hp, u.hp + h);
  });
}
function checkOver() {
  if (G.over) return;
  const alive = G.factions.filter(f => f.alive);
  if (!G.factions[0].alive) {
    G.over = true;
    G.winner = alive.sort((a, b) => score(b.i) - score(a.i))[0].i;
  } else if (alive.length === 1) {
    G.over = true;
    G.winner = 0;
  }
  if (G.over) showEnd(false);
}
