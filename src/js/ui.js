'use strict';
/*
 * The 2D interface: everything that is HTML rather than WebGL.
 *
 * ui() is the single redraw entry point. It is cheap to call after any change: setHTML() skips
 * DOM writes when the markup string is unchanged, and numbers tick toward their targets instead
 * of jumping. Also here: the action bar (ctxHTML), tooltips, the coach that teaches the first
 * few turns, the research / help / menu / end-of-game overlays, saving and loading, and the
 * setup screen.
 */
const HTMLC = {},
  NUM = {
    flux: { el: $('#flux'), cur: null, tgt: 0 },
    score: { el: $('#score'), cur: null, tgt: 0 }
  };
function setHTML(q, h) {
  if (HTMLC[q] === h) return false;
  HTMLC[q] = h;
  $(q).innerHTML = h;
  return true;
}
function setNum(k, v) {
  const n = NUM[k];
  n.tgt = v;
  if (reduce || n.cur === null || !GL) {
    n.cur = v;
    n.el.textContent = v;
  }
}
function showBanner(title, sub, color) {
  const b = $('#banner');
  if (!b) return;
  b.firstElementChild.textContent = title;
  b.lastElementChild.textContent = sub || '';
  b.style.setProperty('--bc', color || 'var(--accent)');
  b.classList.remove('on');
  void b.offsetWidth;
  b.classList.add('on');
  // The plate shares its slot with the coach tip, which steps aside (CSS) while `on` is set.
  b.onanimationend = () => b.classList.remove('on');
}
/* what an attack will do, before you commit to it */
function forecast(a, d) {
  const dmg = dmgCalc(a, d, false),
    kill = dmg >= d.hp;
  return {
    dmg,
    kill,
    ret:
      !kill && cheb(a.x, a.y, d.x, d.y) <= UT[d.type].rng
        ? dmgCalc(Object.assign({}, d, { hp: d.hp - dmg }), a, true)
        : 0
  };
}
const COACH = [
  [
    'Tap your Trooper to select it.',
    () => !!sel && sel.kind === 'unit' && G.units.some(u => u.id === sel.id && u.owner === 0)
  ],
  [
    'Tap a glowing tile to move toward the unexplored blocks.',
    () => G.turn > 1 || G.units.some(u => u.owner === 0 && u.moved)
  ],
  ['Each unit acts once per turn. Press End turn.', () => G.turn > 1],
  [
    'Tap your capital and train a second unit.',
    () => G.units.filter(u => u.owner === 0).length > 1
  ],
  ['Find an outpost. Park a unit on it, then capture it next turn.', () => nCities(0) > 1],
  [
    'Open Research to unlock new units and harvesting.',
    () => Object.keys(G.factions[0].techs).length > 1
  ],
  [
    'Tap a resource inside your borders to harvest it and grow the city.',
    () => G.cities.some(c => c.owner === 0 && (c.level > 1 || c.pop > 0))
  ],
  ['You have the basics. Hold the most ground when the last turn ends.', () => false]
];
function coachStep() {
  const el = $('#coach');
  if (!SET.tips || G.over || G.coach === undefined || G.coach < 0) {
    el.hidden = true;
    return;
  }
  while (G.coach < COACH.length - 1 && COACH[G.coach][1]()) G.coach++;
  if (G.coach === COACH.length - 1) {
    if (!G.coachEnd) G.coachEnd = G.turn;
    if (G.turn > G.coachEnd) {
      G.coach = -1;
      el.hidden = true;
      try {
        localStorage.setItem('shardfall-coached', '1');
      } catch (e) {}
      return;
    }
  }
  $('#coachText').textContent = COACH[G.coach][0];
  el.hidden = false;
}
function ui() {
  if (!G) return;
  const P = G.factions[0],
    ready = G.units.filter(u => u.owner === 0 && (canAct(u) || canCapture(u))).length,
    eb = $('#endBtn'),
    nb = $('#nextBtn');
  $('#turn').textContent = Math.min(G.turn, G.maxTurns) + '/' + G.maxTurns;
  setNum('flux', P.flux);
  $('#inc').textContent = '+' + income(0);
  setNum('score', score(0));
  eb.disabled = busy || G.over;
  eb.textContent = busy ? 'Rivals moving' : G.over ? 'Game over' : 'End turn';
  eb.classList.toggle('go', !busy && !G.over && ready === 0);
  nb.disabled = busy || G.over || !ready;
  nb.textContent = ready ? `Next unit (${ready})` : 'No units ready';
  $('#techBtn').disabled = busy || G.over;
  $('#techDot').hidden =
    busy ||
    G.over ||
    !Object.keys(TECHS).some(
      k => !P.techs[k] && (!TECHS[k].req || P.techs[TECHS[k].req]) && P.flux >= techCost(0, k)
    );
  setHTML(
    '#rivals',
    G.factions
      .map(
        f =>
          `<div class="rival${f.alive ? '' : ' dead'}"><span class="dot" style="background:${cult(f.i).color}"></span><span class="nm">${cult(f.i).name}${f.i === 0 ? ' (you)' : ''}</span><span class="num">${nCities(f.i)} ${nCities(f.i) === 1 ? 'city' : 'cities'} · ${score(f.i)}</span></div>`
      )
      .join('')
  );
  setHTML('#log', G.log.map(m => `<li>${m}</li>`).join(''));
  const pk =
      (sel ? sel.kind + ':' + (sel.kind === 'tile' ? sel.x + ',' + sel.y : sel.id) : 'none') +
      (busy ? 'b' : '') +
      (G.over ? 'o' : ''),
    pn = $('#ctx');
  if (setHTML('#ctx', ctxHTML())) paintIcons();
  if (pk !== ui.pk) {
    ui.pk = pk;
    pn.classList.remove('in');
    void pn.offsetWidth;
    pn.classList.add('in');
  }
  coachStep();
}
function ctxHTML() {
  const P = G.factions[0],
    pill = a =>
      `<div class="pills">${a.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}</div>`;
  if (G.over)
    return `<div class="cx"><div class="cxt"><span class="label">Game over</span><h3>The board is settled</h3></div><div class="cxa"><button class="btn" data-act="results">Results</button></div></div>`;
  if (sel && sel.kind === 'unit') {
    const u = G.units.find(u => u.id === sel.id);
    if (u) {
      const U = UT[u.type],
        mine = u.owner === 0,
        c = cityAt(u.x, u.y),
        db = defBonus(u),
        fr = u.hp / U.hp,
        t = G.tiles[idx(u.x, u.y)];
      let h = `<div class="cx"><canvas class="ico" data-unit="${u.type}" data-key="${G.factions[u.owner].key}"></canvas><div class="cxt"><span class="label" style="color:${cult(u.owner).color}">${cult(u.owner).name}</span><h3>${U.name}</h3><div class="bar"><i style="width:${100 * fr}%;background:${fr > 0.5 ? 'var(--good)' : fr > 0.25 ? '#ffb347' : 'var(--danger)'}"></i></div></div>`;
      h += pill([
        ['HP', u.hp + '/' + U.hp],
        ['ATK', U.atk],
        ['DEF', U.def + (db > 1 ? ' ×' + db : '')],
        ['MOVE', U.mov],
        ['RANGE', U.rng]
      ]);
      let note,
        acts = '';
      if (mine && !busy) {
        if (canCapture(u))
          acts += `<button class="btn primary" data-act="capture">Capture ${c.name}</button>`;
        if (UNDO && UNDO.id === u.id && !u.attacked)
          acts += `<button class="btn" data-act="undo" title="Undo move (Z)">Undo move</button>`;
        note =
          u.moved && u.attacked
            ? 'Spent for this turn.'
            : c && c.owner !== 0 && !canCapture(u)
              ? `Hold here. It can capture ${c.name} at the start of your next turn.`
              : !u.moved
                ? 'Tap a glowing tile to move or a red tile to attack. Resting units heal.'
                : atks && atks.length
                  ? 'Moved. It can still attack a red tile.'
                  : 'Moved. Nothing in range to attack.';
      } else
        note = mine
          ? 'Rivals are moving.'
          : `Standing on ${TNAME[G.factions[t.b || 0].key][t.t].toLowerCase()}.`;
      return (
        h + (acts ? `<div class="cxa">${acts}</div>` : '') + `<p class="cxn">${note}</p></div>`
      );
    }
  }
  if (sel && sel.kind === 'city') {
    const c = G.cities[sel.id],
      need = c.level + 1,
      inc =
        c.level +
        (c.capital ? 1 : 0) +
        (c.capital && c.owner >= 0 && G.factions[c.owner].key === 'helion' ? 2 : 0);
    let h = `<div class="cx"><div class="cxt"><span class="label" style="color:${c.owner >= 0 ? cult(c.owner).color : 'var(--muted)'}">${c.owner >= 0 ? cult(c.owner).name + (c.capital ? ' · capital' : '') : 'Unclaimed outpost'}</span><h3>${c.name}</h3><div class="bar"><i style="width:${(100 * c.pop) / need}%"></i></div></div>`;
    h += pill(
      [
        ['LEVEL', c.level],
        ['GROWTH', c.pop + '/' + need],
        ['INCOME', '+' + inc]
      ].concat(c.owner === 0 ? [['ARMY', armySize(0) + '/' + supply(0)]] : [])
    );
    let note;
    if (c.owner === 0) {
      const occ = !!unitAt(c.x, c.y),
        full = armySize(0) >= supply(0);
      h += '<div class="cards">';
      for (const t in UT) {
        const U = UT[t];
        if (U.tech && !P.techs[U.tech]) continue;
        const cost = unitCost(0, t);
        h += `<button class="ucard${P.flux < cost ? ' poor' : ''}" data-act="train" data-v="${t}" ${occ || full || busy || P.flux < cost ? 'disabled' : ''} title="${U.name}: attack ${U.atk}, defense ${U.def}, ${U.hp} HP, move ${U.mov}, range ${U.rng}"><span class="cost num">${cost}</span><canvas class="ico" data-unit="${t}" data-key="${P.key}"></canvas><b>${U.name}</b><small>ATK ${U.atk} · DEF ${U.def}</small></button>`;
      }
      h += '</div>';
      note = full
        ? 'Army is at its supply limit. Capture or grow cities to field more.'
        : occ
          ? 'Move the unit off this city to train another.'
          : 'New units can act next turn. Harvest inside the borders to grow the city.';
    } else note = 'Park a unit here, then capture it at the start of your next turn.';
    return h + `<p class="cxn">${note}</p></div>`;
  }
  if (sel && sel.kind === 'tile') {
    const t = G.tiles[idx(sel.x, sel.y)],
      hi = harvestInfo(0, sel.x, sel.y),
      own = tileFaction(t),
      key = G.factions[t.b || 0].key;
    let h = `<div class="cx"><div class="cxt"><span class="label">${own >= 0 ? cult(own).name + ' territory' : 'Unclaimed ground'} · ${HOME[key][0]}</span><h3>${TNAME[key][t.t]}${t.res === 'algae' ? ' with algae bed' : t.res === 'ore' ? ' with ore seam' : ''}</h3></div>`,
      acts = '';
    if (hi) {
      const ok = P.techs[hi.tech];
      acts = `<button class="btn${ok && P.flux >= hi.cost ? ' primary' : ''}" data-act="harvest" ${ok && P.flux >= hi.cost && !busy ? '' : 'disabled'}>Harvest · ${hi.cost} flux</button>`;
    }
    const note =
      (t.t === RIDGE
        ? 'Defense ×1.5 and longer sight. Needs Grav Rigs to climb.'
        : t.t === GROVE
          ? 'Defense ×1.25. Entering ends movement.'
          : t.t === WATER
            ? 'Needs Hover Drives to cross. Entering ends movement.'
            : 'Open ground.') +
      (hi
        ? P.techs[hi.tech]
          ? ` Harvesting adds ${hi.pop} growth to ${G.cities[t.o].name}.`
          : ` Harvesting needs ${TECHS[hi.tech].name}.`
        : t.res || (t.t === GROVE && !t.used)
          ? ' Harvestable only inside your own borders.'
          : '');
    return h + (acts ? `<div class="cxa">${acts}</div>` : '') + `<p class="cxn">${note}</p></div>`;
  }
  const n = G.units.filter(u => u.owner === 0 && (canAct(u) || canCapture(u))).length;
  return `<div class="cx"><div class="cxt"><span class="label" style="color:${cult(0).color}">${cult(0).name}</span><h3>${busy ? 'Rivals are moving' : n ? n + (n === 1 ? ' unit is' : ' units are') + ' ready' : 'All units have acted'}</h3></div><p class="cxn">${busy ? 'Watch the board.' : n ? 'Tap a unit, a city or a resource tile.' : 'Press End turn when you are done.'}</p></div>`;
}
function tipHTML(x, y) {
  const k = idx(x, y),
    t = G.tiles[k];
  if (!W3 || !W3.seen[k]) return '<b>Unexplored</b>';
  const key = G.factions[t.b || 0].key,
    u = unitAt(x, y),
    c = cityAt(x, y),
    L = [];
  if (u) {
    const U = UT[u.type];
    L.push(
      `<b style="color:${cult(u.owner).color}">${cult(u.owner).name} ${U.name}</b> · ${u.hp}/${U.hp} HP`
    );
    const a =
      sel && sel.kind === 'unit' && atks && atks.includes(u) && G.units.find(q => q.id === sel.id);
    if (a) {
      const f = forecast(a, u);
      L.push(
        f.kill
          ? 'Attack: destroys it'
          : `Attack: deals ${f.dmg}` + (f.ret ? `, takes ${f.ret} back` : ', no counter-attack')
      );
    }
  }
  if (c)
    L.push(
      `<b>${c.name}</b> · level ${c.level} · ${c.owner >= 0 ? cult(c.owner).name : 'unclaimed'}`
    );
  L.push(
    `<b>${TNAME[key][t.t]}</b>` +
      (t.t === RIDGE ? ' · defense ×1.5' : t.t === GROVE ? ' · defense ×1.25' : '')
  );
  const hi = harvestInfo(0, x, y);
  if (hi)
    L.push(
      `Harvest: ${hi.cost} flux, +${hi.pop} growth` +
        (G.factions[0].techs[hi.tech] ? '' : ` (needs ${TECHS[hi.tech].name})`)
    );
  else if (t.res) L.push(t.res === 'ore' ? 'Ore seam' : 'Algae bed');
  if (moves && moves.has(k)) L.push('Click to move here');
  return L.join('\n');
}
function helpHTML() {
  const rows = Object.keys(UT)
    .map(t => {
      const U = UT[t];
      return `<tr><td>${U.name}</td><td class="num">${U.cost}</td><td class="num">${U.atk}</td><td class="num">${U.def}</td><td class="num">${U.hp}</td><td class="num">${U.mov}</td><td class="num">${U.rng}</td><td>${U.tech ? TECHS[U.tech].name : 'From the start'}</td></tr>`;
    })
    .join('');
  return `<div><h3>Goal</h3><p>Take every rival city, or hold the highest score when turn ${G ? G.maxTurns : 30} ends. Score comes from cities, city levels, research, units, kills and explored ground.</p></div>
<div><h3>Your turn</h3><p>Each unit can move once and attack once. Moving into a grove, onto a ridge or into liquid ends its move. A unit that neither moves nor attacks heals, faster inside your borders. Attacking a unit that can reach you draws a counter-attack. The numbers over a red target show the damage you will deal and take.</p></div>
<div><h3>Cities</h3><p>A unit that starts its turn on another side's city can capture it. Cities pay flux every turn and train units. Harvest resources inside a city's borders to grow it: each level adds income and army supply, and level 3 widens the borders.</p></div>
<div><h3>Units</h3><div class="tw"><table><tr><th>Unit</th><th>Cost</th><th>Atk</th><th>Def</th><th>HP</th><th>Move</th><th>Range</th><th>Unlocked by</th></tr>${rows}</table></div></div>
<div><h3>Terrain</h3><p>Groves give defense ×1.25. Ridges give ×1.5 and longer sight, and need Grav Rigs to climb. Liquid needs Hover Drives to cross. A unit in its own city defends at ×1.5.</p></div>
<div><h3>Controls</h3><p><kbd>Drag</kbd> pan · <kbd>Right-drag</kbd> or <kbd>Shift</kbd>-drag orbit and tilt · <kbd>Scroll</kbd> or pinch to zoom · twist two fingers to spin · double-click to zoom in · click the minimap to jump.</p><p><kbd>Space</kbd> next unit · <kbd>Enter</kbd> end turn · <kbd>Z</kbd> undo a move that revealed nothing · <kbd>T</kbd> research · <kbd>F</kbd> fit board · <kbd>Q</kbd> <kbd>R</kbd> spin · <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or arrows pan · <kbd>H</kbd> this page · <kbd>Esc</kbd> deselect.</p></div>`;
}
function renderMenu() {
  $('#setQuality')
    .querySelectorAll('button')
    .forEach(b => b.setAttribute('aria-pressed', b.dataset.v === SET.quality));
  $('#setFx')
    .querySelectorAll('button')
    .forEach(b => b.setAttribute('aria-pressed', !!SET[b.dataset.k]));
}
function renderTech() {
  const P = G.factions[0];
  $('#techFlux').textContent = P.flux;
  $('#techGrid').innerHTML = BRANCHES.map(
    (b, bi) =>
      `<div class="branch"><span class="label">${b}</span>${Object.keys(TECHS)
        .filter(k => TECHS[k].br === bi)
        .sort((a, c) => TECHS[a].tier - TECHS[c].tier)
        .map(k => {
          const T = TECHS[k],
            own = P.techs[k],
            open = !T.req || P.techs[T.req],
            cost = techCost(0, k);
          return `<button class="tech${own ? ' own' : ''}" data-act="research" data-v="${k}" ${own || !open || P.flux < cost ? 'disabled' : ''}><b>${T.name}</b><span>${T.desc}</span><em class="num">${own ? 'Researched' : open ? cost + ' flux' : 'Needs ' + TECHS[T.req].name}</em></button>`;
        })
        .join('')}</div>`
  ).join('');
}
function showEnd(byTime) {
  const won = G.winner === 0,
    rows = G.factions.slice().sort((a, b) => score(b.i) - score(a.i));
  $('#endKicker').textContent = byTime
    ? 'Turn 30 has ended'
    : won
      ? 'No rivals remain'
      : 'Your last city fell';
  $('#endTitle').textContent = won ? 'Victory' : 'Defeat';
  $('#endTitle').style.color = cult(G.winner).color;
  $('#endText').textContent = won
    ? `The ${cult(0).name} holds the shard.`
    : `The ${cult(G.winner).name} holds the shard.`;
  $('#endTable').innerHTML =
    '<tr><th>Culture</th><th>Cities</th><th>Score</th></tr>' +
    rows
      .map(
        f =>
          `<tr><td style="color:${cult(f.i).color}">${cult(f.i).name}${f.i === 0 ? ' (you)' : ''}</td><td class="num">${nCities(f.i)}</td><td class="num">${score(f.i)}</td></tr>`
      )
      .join('');
  $('#endOv').hidden = false;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {}
}
function save() {
  if (!G || G.over) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(G));
  } catch (e) {}
}
function enter() {
  sel = null;
  moves = atks = null;
  busy = false;
  fx = [];
  pos.clear();
  rotVel = 0;
  document.documentElement.style.setProperty('--accent', cult(0).color);
  $('#setup').hidden = true;
  $('#game').hidden = false;
  $('#endOv').hidden = true;
  $('#techOv').hidden = true;
  NUM.flux.cur = NUM.score.cur = null;
  if (G.tiles[0].b === undefined) assignBiomes();
  UNDO = null;
  $('#veil').classList.remove('off');
  $('#dock').classList.remove('open');
  ['#helpOv', '#menuOv'].forEach(i => {
    $(i).hidden = true;
  });
  initWorld();
  ui();
  if (W3) W3.banner = [cult(0).name, G.over ? 'Final board' : 'Turn ' + G.turn + ' · your move'];
  else showBanner(cult(0).name, 'Turn ' + G.turn);
  if (G.over) showEnd(G.turn > G.maxTurns);
}
function toSetup() {
  for (const k in HTMLC) delete HTMLC[k];
  G = null;
  $('#game').hidden = true;
  $('#endOv').hidden = true;
  $('#setup').hidden = false;
  renderSetup();
}
function renderSetup() {
  document.documentElement.style.setProperty(
    '--accent',
    CULTURES.find(c => c.key === pick.culture).color
  );
  $('#cultures').innerHTML = CULTURES.map(
    c =>
      `<button class="cult" style="--c:${c.color}" data-k="${c.key}" aria-pressed="${c.key === pick.culture}"><canvas class="ico" data-unit="trooper" data-color="${c.color}" data-key="${c.key}"></canvas><h3>${c.name}</h3><p>${c.blurb}</p><p><b>${c.trait}.</b> ${c.traitText}</p><p>Homeland: <b>${HOME[c.key][0]}</b>, ${HOME[c.key][1]}.</p><p>Starts with <b>${TECHS[c.tech].name}</b>.</p></button>`
  ).join('');
  let has = false;
  try {
    has = !!localStorage.getItem(SAVE_KEY);
  } catch (e) {}
  $('#resumeBtn').hidden = !has;
  paintIcons();
}
