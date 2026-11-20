'use strict';
/*
 * Static data and shared state. Loaded first; everything else reads from here.
 *
 *  - Tables: CULTURES (the four sides), UT (unit types), TECHS (the research tree), LAYOUT
 *    (terrain presets), TNAME / HOME (what each culture calls its terrain and homeland).
 *  - State: G is the whole game in one JSON-serializable object (it is also the save file).
 *    sel / moves / atks describe the current selection. `pick` holds the setup-screen choices.
 *  - Helpers: idx(x, y) turns board coordinates into an index into G.tiles; cheb() is the
 *    distance used for both movement and range (king moves, diagonals count as 1).
 *
 * Nothing in this file draws anything or touches the DOM at load time, so it runs under Node
 * for the tests. See docs/ARCHITECTURE.md for the shape of G.
 */
const PLAIN = 0,
  GROVE = 1,
  RIDGE = 2,
  WATER = 3;
const TNAME = {
  helion: ['Sunplate flats', 'Parasol orchard', 'Mesa', 'Molten channel'],
  verdant: ['Moss beds', 'Sporewood', 'Root mound', 'Algal lagoon'],
  choir: ['Black glass', 'Pylon field', 'Monolith stack', 'Mercury pool'],
  tide: ['Tidal flats', 'Coral garden', 'Sea stack', 'Lagoon']
};
const HOME = {
  helion: ['Sunfields', 'gold mesas, solar orchards and molten channels'],
  verdant: ['Overgrowth', 'moss beds, giant mushrooms and glowing lagoons'],
  choir: ['Black Lattice', 'obsidian glass, pylon fields and mercury pools'],
  tide: ['Reef', 'tidal flats, coral gardens and turquoise lagoons']
};
const CULTURES = [
  {
    key: 'helion',
    name: 'Helion Concord',
    color: '#f2b441',
    tech: 'excavation',
    trait: 'Dividend',
    traitText: 'Your capital yields +2 flux every turn.',
    blurb: 'Solar-sail merchant priests who tithe every sunrise.'
  },
  {
    key: 'verdant',
    name: 'Verdant Lattice',
    color: '#5fe0a0',
    tech: 'hydroponics',
    trait: 'Regrowth',
    traitText: 'Every unit mends 2 HP each turn, even after fighting.',
    blurb: 'Gene-gardeners who grow their armor instead of forging it.'
  },
  {
    key: 'choir',
    name: 'Null Choir',
    color: '#e85ad0',
    tech: 'ballistics',
    trait: 'Fabricators',
    traitText: 'Units cost 1 flux less (never below 2).',
    blurb: 'A machine collective that votes in a single voice.'
  },
  {
    key: 'tide',
    name: 'Tidewrights',
    color: '#4fb4ff',
    tech: 'thrusters',
    trait: 'Tideborn',
    traitText: 'Your units cross flooded basins from turn one.',
    blurb: 'Drift-city navigators raised on drowned worlds.'
  }
];
const UT = {
  trooper: { name: 'Trooper', cost: 2, hp: 10, atk: 2, def: 2, mov: 1, rng: 1, tech: null },
  skimmer: { name: 'Skimmer', cost: 3, hp: 10, atk: 2, def: 1, mov: 2, rng: 1, tech: 'thrusters' },
  railgunner: {
    name: 'Railgunner',
    cost: 3,
    hp: 8,
    atk: 2,
    def: 1,
    mov: 1,
    rng: 2,
    tech: 'ballistics'
  },
  bulwark: { name: 'Bulwark', cost: 3, hp: 14, atk: 1, def: 4, mov: 1, rng: 1, tech: 'shielding' },
  mech: { name: 'Mech', cost: 6, hp: 16, atk: 4, def: 3, mov: 1, rng: 1, tech: 'mechworks' },
  cannon: { name: 'Arc Cannon', cost: 7, hp: 8, atk: 4, def: 0, mov: 1, rng: 3, tech: 'siege' }
};
const BRANCHES = ['Growth', 'Mobility', 'Firepower', 'Industry'];
const TECHS = {
  hydroponics: {
    name: 'Hydroponics',
    tier: 1,
    br: 0,
    desc: 'Harvest algae beds: 2 flux, +1 population'
  },
  grove: {
    name: 'Grove Synthesis',
    tier: 2,
    br: 0,
    req: 'hydroponics',
    desc: 'Harvest glow groves: 3 flux, +1 population'
  },
  nanomed: {
    name: 'Nanomedics',
    tier: 3,
    br: 0,
    req: 'grove',
    desc: 'Resting units mend twice as fast'
  },
  thrusters: { name: 'Thrusters', tier: 1, br: 1, desc: 'Train Skimmers: fast, move 2' },
  hover: {
    name: 'Hover Drives',
    tier: 2,
    br: 1,
    req: 'thrusters',
    desc: 'All units cross flooded basins'
  },
  recon: {
    name: 'Recon Satellites',
    tier: 3,
    br: 1,
    req: 'hover',
    desc: 'Units see one tile farther'
  },
  ballistics: { name: 'Ballistics', tier: 1, br: 2, desc: 'Train Railgunners: range 2' },
  shielding: {
    name: 'Shielding',
    tier: 2,
    br: 2,
    req: 'ballistics',
    desc: 'Train Bulwarks: defense 4'
  },
  siege: {
    name: 'Siege Optics',
    tier: 3,
    br: 2,
    req: 'shielding',
    desc: 'Train Arc Cannons: range 3, attack 4'
  },
  excavation: {
    name: 'Excavation',
    tier: 1,
    br: 3,
    desc: 'Harvest ore seams: 4 flux, +2 population'
  },
  grav: { name: 'Grav Rigs', tier: 2, br: 3, req: 'excavation', desc: 'All units climb ridges' },
  mechworks: {
    name: 'Mechworks',
    tier: 3,
    br: 3,
    req: 'grav',
    desc: 'Train Mechs: attack 4, 16 HP'
  }
};
const CITY_NAMES = [
  'Vanta',
  'Orrery',
  'Kelvin',
  'Sable',
  'Perihel',
  'Cinder',
  'Halcyon',
  'Meridian',
  'Quill',
  'Tessel',
  'Lumen',
  'Drift',
  'Axiom',
  'Fathom',
  'Zenith',
  'Ember',
  'Nacre',
  'Solace',
  'Parallax',
  'Brine',
  'Gantry',
  'Umbra'
];
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1]
];
const SAVE_KEY = 'shardfall-save-v1';
const $ = s => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

let G = null,
  sel = null,
  moves = null,
  atks = null,
  busy = false,
  fx = [];
const pos = new Map();
let pick = { culture: 'helion', size: 11, rivals: 2, layout: 'balanced', atmo: 'random' };
const LAYOUT = {
  balanced: [-1.1, 1.3, 0.24],
  islands: [-0.35, 1.6, 0.2],
  highlands: [-1.7, 0.55, 0.18],
  wilds: [-1.4, 1.5, 0.5]
};

const idx = (x, y) => y * G.N + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < G.N && y < G.N;
const cheb = (a, b, c, d) => Math.max(Math.abs(a - c), Math.abs(b - d));
const cult = i => CULTURES.find(c => c.key === G.factions[i].key);
const unitAt = (x, y) => G.units.find(u => u.x === x && u.y === y);
const cityAt = (x, y) => {
  const c = G.tiles[idx(x, y)].c;
  return c >= 0 ? G.cities[c] : null;
};
const tileFaction = t => (t.o >= 0 ? G.cities[t.o].owner : -1);
const nCities = i => G.cities.filter(c => c.owner === i).length;
const log = m => {
  G.log.unshift(m);
  G.log.length = Math.min(G.log.length, 7);
};
