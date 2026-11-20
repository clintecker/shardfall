#!/usr/bin/env node
// Regenerates the images in docs/media from the real game, so the README never shows a
// version of Shardfall that no longer exists.
//
//   npm run screenshots            everything
//   npm run screenshots -- skies   only the shots whose name starts with "skies"
//
// Needs Playwright (see test/e2e/browser.mjs). Without a GPU this renders in software and takes
// several minutes; that is normal. Maps are seeded, so reruns produce the same boards.
import { mkdir } from 'node:fs/promises';
import { firstFrame, launch } from '../test/e2e/browser.mjs';
import { fromRoot } from './lib/manifest.mjs';

const only = process.argv[2] || '';
const OUT = fromRoot('docs', 'media');
await mkdir(OUT, { recursive: true });

const wants = name => name.startsWith(only);
const save = (target, name, more = {}) => {
  console.log(`  docs/media/${name}.jpg`);
  return target.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80, ...more });
};

/** Plays `turns` turns for the player with a simple script: grab cities, expand, tech up. */
const autoplay = (page, turns) =>
  page.evaluate(async turns => {
    for (let t = 0; t < turns && !G.over; t++) {
      for (const u of G.units.filter(u => u.owner === 0)) {
        if (canCapture(u)) {
          capture(u);
          continue;
        }
        const foe = targets(u)[0];
        if (foe && dmgCalc(u, foe, false) >= foe.hp) {
          attack(u, foe);
          continue;
        }
        const reach = [...reachable(u).values()];
        if (!reach.length || u.moved) continue;
        const city = reach.find(([x, y]) => cityAt(x, y) && cityAt(x, y).owner !== 0);
        const dark = reach.find(([x, y]) =>
          DIRS.some(
            ([dx, dy]) => inb(x + dx, y + dy) && !G.factions[0].explored[idx(x + dx, y + dy)]
          )
        );
        const [x, y] = city || dark || reach[(Math.random() * reach.length) | 0];
        if (!cityAt(u.x, u.y) || cityAt(u.x, u.y).owner === 0) moveUnit(u, x, y);
      }
      for (const k in TECHS) research(0, k);
      for (let y = 0; y < G.N; y++) for (let x = 0; x < G.N; x++) harvest(0, x, y);
      for (const c of G.cities)
        if (c.owner === 0) train(0, c, Object.keys(UT)[t % 6]) || train(0, c, 'trooper');
      await endTurn();
    }
  }, turns);

const settle = (page, ms = 6000) => page.waitForTimeout(ms);

async function session(opts, fn) {
  const s = await launch(opts);
  try {
    await s.page.goto(s.url);
    await s.page.evaluate(() => localStorage.clear());
    await s.page.reload();
    await s.page.waitForSelector('#cultures button');
    await fn(s.page);
    if (s.errors.length) console.warn('  console:', [...new Set(s.errors)].join(' | '));
  } finally {
    await s.close();
  }
}

const start = async (page, { culture, size = 11, rivals = 2, layout = 'balanced', atmo }) => {
  await page.click(`#cultures button[data-k="${culture}"]`);
  await page.click(`#optSize button[data-v="${size}"]`);
  await page.click(`#optRivals button[data-v="${rivals}"]`);
  await page.click(`#optLayout button[data-v="${layout}"]`);
  await page.click(`#optAtmo button[data-v="${atmo}"]`);
  await page.click('#startBtn');
  await firstFrame(page);
};

/* ---- the setup screen, and the game in play at desktop size ---- */
if (wants('setup') || wants('play')) {
  console.log('desktop');
  await session(
    { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, seed: 30 },
    async page => {
      await settle(page, 1500);
      if (wants('setup')) await save(page, 'setup', { fullPage: true });
      if (!wants('play')) return;
      await start(page, { culture: 'helion', rivals: 3, atmo: 'dusk' });
      await settle(page);
      await autoplay(page, 9);
      await page.evaluate(() => {
        G.coach = -1;
        const mine = G.units.filter(u => u.owner === 0);
        const u = mine.find(u => targets(u).length) || mine[0];
        u.moved = u.attacked = false;
        setSel({ kind: 'unit', id: u.id });
        focusOn(u.x, u.y);
        want.yaw = 0.62;
        want.pitch = 0.74;
        want.dist = Math.max(8.5, fitDist() * 0.5);
      });
      await settle(page);
      await save(page, 'play-unit');
      await page.evaluate(() => {
        const c =
          G.cities.find(c => c.owner === 0 && c.capital) || G.cities.find(c => c.owner === 0);
        setSel({ kind: 'city', id: c.id });
        focusOn(c.x, c.y);
      });
      await settle(page, 4000);
      await save(page, 'play-city');
      // Clicked from inside the page: a real pointer click waits for the page to go idle, which
      // can take longer than the timeout while a software renderer is busy with a 5-megapixel frame.
      await page.evaluate(() => $('#techBtn').click());
      await settle(page, 1500);
      await save(page, 'play-research');
    }
  );
}

/* ---- one clean, fully revealed board under each of the five skies ---- */
if (wants('skies')) {
  console.log('skies');
  const SKIES = [
    ['storm', 'choir', 'balanced'],
    ['dusk', 'helion', 'highlands'],
    ['aurora', 'verdant', 'wilds'],
    ['eclipse', 'choir', 'balanced'],
    ['dawn', 'tide', 'islands']
  ];
  for (const [i, [atmo, culture, layout]] of SKIES.entries()) {
    await session(
      { viewport: { width: 960, height: 600 }, deviceScaleFactor: 2, seed: 100 + i },
      async page => {
        // a beauty shot: no interface, the whole map out of the fog
        await page.addStyleTag({
          content:
            '.hudtop,.ctx,#mini,#coach,#zoom,#banner,#tip{visibility:hidden!important}.stage{border:0!important}'
        });
        await start(page, { culture, rivals: 3, layout, atmo });
        await settle(page, 3000);
        await autoplay(page, 6);
        await page.evaluate(() => {
          G.factions[0].explored.fill(1);
          setSel(null);
          want.x = want.z = 0;
          want.yaw = 0.9;
          want.pitch = 0.52;
          want.dist = fitDist() * 0.78;
        });
        await settle(page, 9000);
        await save(page, `skies-${atmo}`);
      }
    );
  }
}

/* ---- every unit of every culture, rendered by the game's own portrait camera ---- */
if (wants('roster')) {
  console.log('roster');
  await session({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 }, async page => {
    await page.evaluate(() => {
      const types = ['trooper', 'skimmer', 'railgunner', 'bulwark', 'mech', 'cannon'];
      const CELL = 190, // one portrait
        GAP = 14,
        LEFT = 168, // room for the culture names
        TOP = 46, // room for the unit names
        W = LEFT + types.length * (CELL + GAP),
        H = TOP + CULTURES.length * (CELL + GAP) + GAP;
      const c = document.createElement('canvas');
      c.id = 'roster';
      c.width = W * 2;
      c.height = H * 2;
      c.style.cssText = `position:fixed;left:0;top:0;z-index:99;width:${W}px;height:${H}px`;
      const x = c.getContext('2d');
      x.scale(2, 2);
      x.fillStyle = '#0c0e1a';
      x.fillRect(0, 0, W, H);
      const face = '"Chakra Petch","Trebuchet MS",sans-serif';
      x.textBaseline = 'middle';
      types.forEach((t, i) => {
        x.font = `600 12px ${face}`;
        x.fillStyle = '#8d94b5';
        x.textAlign = 'center';
        x.fillText(
          UT[t].name.toUpperCase().split('').join('\u200a'),
          LEFT + i * (CELL + GAP) + CELL / 2,
          TOP / 2 + 4
        );
      });
      CULTURES.forEach((cu, j) => {
        const y = TOP + j * (CELL + GAP);
        x.fillStyle = '#141830';
        x.fillRect(LEFT - 6, y, W - LEFT - GAP + 6, CELL);
        x.fillStyle = cu.color;
        x.fillRect(LEFT - 6, y, 3, CELL);
        x.textAlign = 'left';
        x.font = `700 15px ${face}`;
        x.fillText(cu.name, 16, y + CELL / 2 - 10);
        x.font = `500 11px ${face}`;
        x.fillStyle = '#8d94b5';
        x.fillText(HOME[cu.key][0].toUpperCase(), 16, y + CELL / 2 + 12);
        types.forEach((t, i) => {
          const im = portrait(t, cu.key, true);
          if (im) x.drawImage(im, LEFT + i * (CELL + GAP) + 8, y + 6, CELL - 16, CELL - 16);
        });
      });
      document.body.appendChild(c);
    });
    await settle(page, 500);
    await save(page.locator('#roster'), 'roster');
  });
}

/* ---- the phone layout ---- */
if (wants('phone')) {
  console.log('phone');
  await session(
    { viewport: { width: 400, height: 820 }, deviceScaleFactor: 2, seed: 7 },
    async page => {
      await start(page, { culture: 'tide', size: 9, rivals: 2, layout: 'islands', atmo: 'dawn' });
      await settle(page, 4000);
      await autoplay(page, 7);
      await page.evaluate(() => {
        G.coach = -1;
        const c = G.cities.find(c => c.owner === 0);
        setSel({ kind: 'city', id: c.id });
        focusOn(c.x, c.y);
      });
      await settle(page);
      await save(page, 'phone');
    }
  );
}
