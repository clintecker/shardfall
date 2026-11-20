'use strict';
/*
 * Startup. Wires the buttons and overlays to the functions defined in the files above, then
 * calls start(). This is the only file that runs anything at load time besides declarations,
 * which is why it is loaded last.
 */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b && !b.disabled) act(b.dataset.act, b.dataset.v);
});
$('#cultures').addEventListener('click', e => {
  const b = e.target.closest('.cult');
  if (b) {
    pick.culture = b.dataset.k;
    renderSetup();
  }
});
for (const [id, key, num] of [
  ['#optSize', 'size', 1],
  ['#optRivals', 'rivals', 1],
  ['#optLayout', 'layout', 0],
  ['#optAtmo', 'atmo', 0]
])
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    pick[key] = num ? +b.dataset.v : b.dataset.v;
    $(id)
      .querySelectorAll('button')
      .forEach(x => x.setAttribute('aria-pressed', x === b));
  });
const open = id => {
    $(id).hidden = false;
  },
  shut = id => {
    $(id).hidden = true;
  },
  anyOpen = () => ['#techOv', '#helpOv', '#menuOv', '#endOv'].some(i => !$(i).hidden);
$('#startBtn').onclick = () => {
  let done = false;
  try {
    done = !!localStorage.getItem('shardfall-coached');
  } catch (e) {}
  newGame(pick.culture, pick.size, pick.rivals);
  G.coach = done ? -1 : 0;
  enter();
  save();
};
$('#resumeBtn').onclick = () => {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.tiles) {
      G = s;
      enter();
      return;
    }
  } catch (e) {}
  $('#resumeBtn').hidden = true;
};
$('#endBtn').onclick = endTurn;
$('#nextBtn').onclick = nextUnit;
$('#techBtn').onclick = () => {
  if (G && !busy && !G.over) {
    renderTech();
    open('#techOv');
  }
};
$('#techClose').onclick = () => shut('#techOv');
const showHelp = () => {
  $('#helpBody').innerHTML = helpHTML();
  open('#helpOv');
};
$('#helpBtn').onclick = showHelp;
$('#setupHelp').onclick = showHelp;
$('#helpClose').onclick = () => shut('#helpOv');
$('#menuBtn').onclick = () => {
  renderMenu();
  open('#menuOv');
};
$('#menuClose').onclick = () => shut('#menuOv');
$('#menuHelp').onclick = () => {
  shut('#menuOv');
  showHelp();
};
$('#infoBtn').onclick = () => $('#dock').classList.toggle('open');
$('#dockClose').onclick = () => $('#dock').classList.remove('open');
for (const id of ['#techOv', '#helpOv', '#menuOv'])
  $(id).addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.hidden = true;
  });
$('#setQuality').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  SET.quality = b.dataset.v;
  saveSet();
  renderMenu();
  applySet();
});
$('#setFx').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const k = b.dataset.k;
  SET[k] = !SET[k];
  if (k === 'tips' && SET.tips && G && G.coach < 0) {
    G.coach = 0;
    G.coachEnd = 0;
  }
  saveSet();
  renderMenu();
  applySet();
  ui();
});
$('#coachSkip').onclick = () => {
  SET.tips = false;
  saveSet();
  ui();
};
$('#endView').onclick = () => {
  shut('#endOv');
  ui();
};
$('#endNew').onclick = toSetup;
let quitArm = 0;
$('#quitBtn').onclick = e => {
  if (Date.now() - quitArm < 4000) {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (x) {}
    e.target.textContent = 'Abandon and start over';
    shut('#menuOv');
    toSetup();
  } else {
    quitArm = Date.now();
    e.target.textContent = 'Press again to abandon this game';
    setTimeout(() => {
      e.target.textContent = 'Abandon and start over';
    }, 4000);
  }
};
const KEYS = new Set(),
  PAN = {
    w: [0, 1],
    arrowup: [0, 1],
    s: [0, -1],
    arrowdown: [0, -1],
    a: [-1, 0],
    arrowleft: [-1, 0],
    d: [1, 0],
    arrowright: [1, 0]
  };
document.addEventListener('keydown', e => {
  if (!G || gameEl.hidden || e.target.closest('input,textarea') || e.ctrlKey || e.metaKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    if (anyOpen()) {
      ['#techOv', '#helpOv', '#menuOv'].forEach(shut);
    } else setSel(null);
    return;
  }
  if (anyOpen()) return;
  if (e.target.closest('button') && (k === ' ' || k === 'enter')) return;
  if (PAN[k]) {
    KEYS.add(k);
    e.preventDefault();
  } else if (k === 'enter' || k === 'e') endTurn();
  else if (k === ' ' || k === 'n' || k === 'tab') {
    e.preventDefault();
    nextUnit();
  } else if (k === 'q') rotVel = -1.7;
  else if (k === 'r') rotVel = 1.7;
  else if (k === 't') $('#techBtn').click();
  else if (k === 'f') fitView();
  else if (k === 'h' || k === '?') showHelp();
  else if (k === 'z') act('undo');
});
document.addEventListener('keyup', e => {
  KEYS.delete(e.key.toLowerCase());
});
window.addEventListener('blur', () => KEYS.clear());
function start(d) {
  renderSetup();
  if (d && d.G && d.G.tiles) {
    G = d.G;
    enter();
  }
  requestAnimationFrame(frame);
}
window.claude?.hot?.snapshot?.(() => ({ G: busy ? null : G }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
