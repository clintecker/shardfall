'use strict';
/*
 * The rivals, and the turn loop that runs them.
 *
 * Each rival unit, in order: capture if it can, else take the best attack on offer, else walk
 * toward the nearest city it does not own (or an intruder near home, or unexplored ground), then
 * attack again if something came into range. After its units, a rival trains, researches the
 * next tech on its shuffled wish list, harvests what it can afford, and trains again.
 *
 * Rivals pay the same costs and earn the same income as the player, with one honest cheat:
 * they are not bound by fog of war. They know where every city is and can shoot anything in
 * range. endTurn() is the only async function in the logic layer; it pauses briefly between
 * rival actions the player can see.
 */
function distMap(f, sx, sy) {
  const d = new Array(G.N * G.N).fill(99),
    q = [[sx, sy]];
  d[idx(sx, sy)] = 0;
  while (q.length) {
    const [x, y] = q.shift(),
      c = d[idx(x, y)];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx,
        ny = y + dy;
      if (!inb(nx, ny)) continue;
      const k = idx(nx, ny);
      if (d[k] < 99 || !canEnter(f, G.tiles[k])) continue;
      d[k] = c + 1;
      q.push([nx, ny]);
    }
  }
  return d;
}
const seen = (x, y) => G.factions[0].explored[idx(x, y)];
async function beat(x, y) {
  if (seen(x, y) && !reduce) await sleep(130);
}
function aiAttack(u) {
  let best = null,
    bs = 0;
  for (const t of targets(u)) {
    const d = dmgCalc(u, t, false),
      k = d >= t.hp;
    const r = !k && cheb(u.x, u.y, t.x, t.y) <= UT[t.type].rng ? dmgCalc(t, u, true) : 0;
    const s = d * (k ? 3 : 1) - r + (r >= u.hp ? -20 : 0) + 0.1;
    if (s > bs) {
      bs = s;
      best = t;
    }
  }
  if (best) {
    attack(u, best);
    return true;
  }
  return false;
}
async function aiUnit(u) {
  const f = G.factions[u.owner];
  if (canCapture(u)) {
    capture(u);
    await beat(u.x, u.y);
    return;
  }
  if (aiAttack(u)) {
    await beat(u.x, u.y);
    return;
  }
  const here = cityAt(u.x, u.y);
  if (
    here &&
    here.owner === u.owner &&
    G.units.some(e => e.owner !== u.owner && cheb(e.x, e.y, u.x, u.y) <= 2)
  )
    return;
  const dm = distMap(f, u.x, u.y);
  let goal = null,
    best = 1e9;
  for (const c of G.cities) {
    if (c.owner === u.owner) continue;
    const d = dm[idx(c.x, c.y)];
    if (d >= 99) continue;
    const o = unitAt(c.x, c.y),
      w =
        d + (c.owner < 0 ? 0 : 1.5) + (o && o.owner === u.owner && o !== u ? 7 : 0) + Math.random();
    if (w < best) {
      best = w;
      goal = [c.x, c.y];
    }
  }
  for (const e of G.units) {
    if (e.owner === u.owner) continue;
    if (!G.cities.some(c => c.owner === u.owner && cheb(c.x, c.y, e.x, e.y) <= 3)) continue;
    for (const [dx, dy] of DIRS) {
      const x = e.x + dx,
        y = e.y + dy;
      if (inb(x, y) && dm[idx(x, y)] - 2 < best) {
        best = dm[idx(x, y)] - 2;
        goal = [x, y];
      }
    }
  }
  if (!goal) {
    for (let k = 0; k < dm.length; k++)
      if (!f.explored[k] && dm[k] < best) {
        best = dm[k];
        goal = [k % G.N, (k / G.N) | 0];
      }
  }
  if (!goal) return;
  const gm = distMap(f, goal[0], goal[1]);
  let bt = null,
    bsc = gm[idx(u.x, u.y)] * 10;
  for (const [k, [x, y]] of reachable(u)) {
    const s =
      gm[k] * 10 -
      (targets(u, x, y).length ? 4 : 0) -
      (G.tiles[k].t !== PLAIN ? 1 : 0) +
      Math.random();
    if (s < bsc) {
      bsc = s;
      bt = [x, y];
    }
  }
  if (bt) {
    moveUnit(u, bt[0], bt[1]);
    await beat(u.x, u.y);
  }
  if (aiAttack(u)) await beat(u.x, u.y);
}
function aiTrain(i, cap) {
  const f = G.factions[i];
  for (const c of G.cities) {
    if (c.owner !== i || unitAt(c.x, c.y)) continue;
    if (G.units.filter(u => u.owner === i).length >= cap) return;
    const opts = Object.keys(UT).filter(
      t => (!UT[t].tech || f.techs[UT[t].tech]) && unitCost(i, t) <= f.flux
    );
    if (!opts.length) return;
    opts.sort((a, b) => UT[b].cost - UT[a].cost);
    train(i, c, Math.random() < 0.55 ? opts[0] : opts[(Math.random() * opts.length) | 0]);
  }
}
async function aiTurn(i) {
  const f = G.factions[i];
  for (const u of G.units.filter(u => u.owner === i)) {
    if (G.over || !f.alive) return;
    if (G.units.includes(u)) await aiUnit(u);
  }
  if (G.over) return;
  aiTrain(i, nCities(i) + 1);
  const next = f.pref.find(k => !f.techs[k] && (!TECHS[k].req || f.techs[TECHS[k].req]));
  if (next) research(i, next);
  for (let y = 0; y < G.N; y++)
    for (let x = 0; x < G.N; x++) {
      const h = harvestInfo(i, x, y);
      if (h && f.techs[h.tech] && f.flux >= h.cost + 1) harvest(i, x, y);
    }
  aiTrain(i, nCities(i) * 2 + 2);
}
async function endTurn() {
  if (busy || !G || G.over) return;
  busy = true;
  UNDO = null;
  setSel(null);
  finishTurn(0);
  showBanner('Rivals moving', 'Turn ' + G.turn + ' of ' + G.maxTurns, '#9fc6e6');
  for (let i = 1; i < G.factions.length && !G.over; i++) {
    if (!G.factions[i].alive) continue;
    startTurn(i);
    await aiTurn(i);
    if (G.factions[i].alive) finishTurn(i);
    ui();
  }
  if (!G.over) {
    G.turn++;
    if (G.turn > G.maxTurns) {
      G.over = true;
      G.winner = G.factions.filter(f => f.alive).sort((a, b) => score(b.i) - score(a.i))[0].i;
      showEnd(true);
    } else {
      startTurn(0);
      showBanner('Your move', 'Turn ' + G.turn + ' of ' + G.maxTurns);
    }
  }
  busy = false;
  save();
  ui();
}
