'use strict';
/*
 * What a click means. Translates "the player tapped tile (x, y)" or "pressed a button" into
 * rule calls, and owns the selection, the one-step undo and the saved settings.
 *
 *  - clickTile(): attack a highlighted target, move to a highlighted tile, or select whatever is
 *    on the tile (unit, then city, then the tile itself; clicking again cycles).
 *  - act(): the action-bar verbs (capture, train, harvest, research, undo).
 *  - UNDO: a move can be taken back only if it revealed no new tiles, so undo never leaks
 *    information.
 *  - SET: quality and effects toggles, persisted in localStorage.
 */
function setSel(s) {
  sel = s;
  moves = null;
  atks = null;
  if (s && s.kind === 'unit') {
    const u = G.units.find(u => u.id === s.id);
    if (u && u.owner === 0 && !busy && !G.over) {
      moves = u.moved ? new Map() : reachable(u);
      atks = u.attacked ? [] : targets(u);
    }
  }
  ui();
}
const canAct = u => !u.moved || (!u.attacked && targets(u).length > 0);
function afterAction(u) {
  if (G.over) {
    sel = null;
    moves = atks = null;
    ui();
    return;
  }
  setSel(G.units.includes(u) ? { kind: 'unit', id: u.id } : null);
}
function clickTile(x, y) {
  if (!G || busy || G.over) return;
  const k = idx(x, y);
  if (sel && sel.kind === 'unit') {
    const u = G.units.find(u => u.id === sel.id);
    if (u && u.owner === 0) {
      const t = atks && atks.find(t => t.x === x && t.y === y);
      if (t) {
        UNDO = null;
        attack(u, t);
        afterAction(u);
        return;
      }
      if (moves && moves.has(k)) {
        const ex = G.factions[0].explored,
          n0 = ex.reduce((a, b) => a + b, 0),
          o = { id: u.id, x: u.x, y: u.y, fx: u.fx, fy: u.fy };
        moveUnit(u, x, y);
        UNDO = ex.reduce((a, b) => a + b, 0) === n0 ? o : null;
        afterAction(u);
        return;
      }
    }
  }
  if (!G.factions[0].explored[k]) {
    setSel(null);
    return;
  }
  const u = unitAt(x, y),
    c = cityAt(x, y);
  if (u && !(sel && sel.kind === 'unit' && sel.id === u.id)) setSel({ kind: 'unit', id: u.id });
  else if (c && !(sel && sel.kind === 'city' && sel.id === c.id))
    setSel({ kind: 'city', id: c.id });
  else if (sel && sel.kind === 'tile' && sel.x === x && sel.y === y && u)
    setSel({ kind: 'unit', id: u.id });
  else setSel({ kind: 'tile', x, y });
}
let UNDO = null;
const SET = Object.assign(
  { quality: 'auto', weather: true, dof: true, ao: true, tips: true },
  (() => {
    try {
      return JSON.parse(localStorage.getItem('shardfall-settings')) || {};
    } catch (e) {
      return {};
    }
  })()
);
function saveSet() {
  try {
    localStorage.setItem('shardfall-settings', JSON.stringify(SET));
  } catch (e) {}
}
function nextUnit() {
  if (!G || busy || G.over) return;
  const mine = G.units.filter(u => u.owner === 0 && (canAct(u) || canCapture(u)));
  if (!mine.length) {
    setSel(null);
    return;
  }
  const cur = sel && sel.kind === 'unit' ? mine.findIndex(u => u.id === sel.id) : -1,
    u = mine[(cur + 1) % mine.length];
  setSel({ kind: 'unit', id: u.id });
  focusOn(u.x, u.y);
}
function act(a, v) {
  if (!G) return;
  if (a === 'results') {
    showEnd(G.turn > G.maxTurns);
    return;
  }
  if (busy || G.over) return;
  if (a === 'capture') {
    const u = G.units.find(u => u.id === sel.id);
    if (u && canCapture(u)) {
      UNDO = null;
      capture(u);
      afterAction(u);
    }
  } else if (a === 'train') {
    const c = G.cities[sel.id];
    if (train(0, c, v)) {
      UNDO = null;
      log(`${c.name} assembled a ${UT[v].name}. It can act next turn.`);
    }
    ui();
  } else if (a === 'harvest') {
    if (harvest(0, sel.x, sel.y)) UNDO = null;
    ui();
  } else if (a === 'research') {
    if (research(0, v)) {
      log(`Breakthrough: ${TECHS[v].name}.`);
      showBanner('Breakthrough', TECHS[v].name);
    }
    setSel(sel);
    renderTech();
  } else if (a === 'undo') {
    const u = UNDO && G.units.find(u => u.id === UNDO.id);
    if (u && !u.attacked) {
      u.x = UNDO.x;
      u.y = UNDO.y;
      u.fx = UNDO.fx;
      u.fy = UNDO.fy;
      u.moved = false;
      UNDO = null;
      setSel({ kind: 'unit', id: u.id });
    }
  }
}
