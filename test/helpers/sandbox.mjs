// Loads the game's logic layer (no rendering, no DOM) into a fresh V8 context so the rules can
// be exercised from Node.
//
// The game is written as classic browser scripts that share one global scope. `vm` reproduces
// that exactly: every script run in the same context sees the others' top-level `const`/`let`
// and function declarations, just like consecutive <script> tags do.
//
// The files loaded here must never touch the DOM at load time. The handful of UI functions the
// rules call as side effects (banner, redraw, autosave) are replaced with recording stubs.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The logic layer, in load order. Everything after this in index.html draws or wires input. */
export const LOGIC = ['data.js', 'world.js', 'rules.js', 'ai.js', 'input.js'];

/** mulberry32: a tiny seeded PRNG so every test game is reproducible. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGame({ seed = 1 } = {}) {
  const calls = [];
  const stub =
    name =>
    (...args) =>
      void calls.push([name, ...args]);
  const math = Object.create(Math);
  math.random = seeded(seed);
  let clock = 0;

  const ctx = vm.createContext({
    console,
    Math: math,
    JSON,
    setTimeout,
    performance: { now: () => (clock += 16) },
    // prefers-reduced-motion: reduce -> the AI skips its dramatic pauses, so games run instantly
    matchMedia: () => ({ matches: true }),
    document: { querySelector: () => null },
    // UI side effects the rules trigger; ui.js and gfx/ are not loaded
    ui: stub('ui'),
    save: stub('save'),
    showBanner: stub('showBanner'),
    showEnd: stub('showEnd'),
    focusOn: stub('focusOn'),
    renderTech: stub('renderTech')
  });

  for (const f of LOGIC) {
    const file = path.join(ROOT, 'src', 'js', f);
    vm.runInContext(readFileSync(file, 'utf8'), ctx, { filename: file });
  }

  /** Evaluate an expression inside the game's global scope: run('G.units.length'). */
  const run = code => vm.runInContext(code, ctx);

  /** Call a game function by name with JSON-able or in-realm arguments. */
  const call = (name, ...args) => {
    ctx.__args = args;
    try {
      return run(`${name}(...__args)`);
    } finally {
      delete ctx.__args;
    }
  };

  return {
    ctx,
    run,
    call,
    calls,
    get G() {
      return run('G');
    },
    /** Start a game the way the setup screen does. */
    start({ culture = 'helion', size = 11, rivals = 2, layout = 'balanced', atmo = 'dusk' } = {}) {
      run(`pick = ${JSON.stringify({ culture, size, rivals, layout, atmo })}`);
      call('newGame', culture, size, rivals);
      return run('G');
    },
    /**
     * A blank, fully explored, all-plains board with one capital per side and no units: a clean
     * bench for testing one rule at a time. Sides: 0 Helion (you), 1 Verdant, 2 Null Choir,
     * 3 Tidewrights.
     */
    arena(N = 9) {
      run(`(() => {
        const keys = ['helion', 'verdant', 'choir', 'tide'];
        G = { N: ${N}, turn: 1, maxTurns: 30, uid: 1, over: false, winner: -1, log: [], tiles: [],
          cities: [], units: [], atmo: 'dusk', layout: 'balanced',
          factions: keys.map((key, i) => ({ i, key, flux: 50, techs: {}, alive: true, kills: 0,
            explored: new Array(${N * N}).fill(1), pref: Object.keys(TECHS) })) };
        for (let k = 0; k < ${N * N}; k++) G.tiles.push({ t: PLAIN, res: null, o: -1, c: -1, used: 0, b: 0 });
        [[1, 1], [${N - 2}, ${N - 2}], [${N - 2}, 1], [1, ${N - 2}]].forEach(([x, y], i) =>
          placeCity(x, y, i, true, 'Capital ' + i));
        pos.clear(); fx.length = 0; sel = null; busy = false;
      })()`);
      return run('G');
    },
    /** Put a rested unit on the board (arena helper). */
    unit(owner, type, x, y, extra = {}) {
      const u = call('spawn', owner, type, x, y, false);
      Object.assign(u, extra);
      return u;
    },
    tile(x, y) {
      return run(`G.tiles[idx(${x}, ${y})]`);
    }
  };
}
