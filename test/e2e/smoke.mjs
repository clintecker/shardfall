#!/usr/bin/env node
// End-to-end smoke test in a real (headless) browser with real WebGL.
//
//   npm run build && npm run test:e2e
//
// It checks what the unit tests cannot: that every script loads in order, three.js boots, the
// first frame is drawn, a turn can be played through the real input path, and nothing logs an
// error along the way. It runs once against the source page and once against the built file.
import { firstFrame, launch } from './browser.mjs';
import { writeBuild } from '../../scripts/build.mjs';

await writeBuild();
const { page, url, errors, close } = await launch();
let failed = false;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) failed = true;
};

try {
  for (const [name, target] of [
    ['source page', url],
    ['built page', url + 'dist/index.html']
  ]) {
    console.log(`\n${name}  ${target}`);
    await page.goto(target);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#cultures button');
    ok((await page.locator('#cultures button').count()) === 4, 'setup screen lists four cultures');

    await page.click('#optSize button[data-v="9"]');
    await page.click('#optRivals button[data-v="3"]');
    await page.click('#optAtmo button[data-v="aurora"]');
    await page.click('#startBtn');
    await firstFrame(page);
    ok(true, 'WebGL scene drew its first frame');

    const world = await page.evaluate(() => ({
      n: G.N,
      factions: G.factions.length,
      atmo: G.atmo,
      units: G.units.length,
      webgl2: GL.renderer.capabilities.isWebGL2,
      depth: GL.depth
    }));
    ok(
      world.n === 9 && world.factions === 4 && world.atmo === 'aurora',
      'setup choices reached the game'
    );
    ok(world.units === 4, 'every side starts with one unit');

    // Play one turn through the same functions the pointer handlers call.
    const moved = await page.evaluate(() => {
      const u = G.units.find(u => u.owner === 0);
      clickTile(u.x, u.y);
      const [x, y] = [...moves.values()][0];
      clickTile(x, y);
      return u.moved && u.x === x && u.y === y;
    });
    ok(moved, 'selecting a unit and clicking a highlighted tile moves it');

    // Announcements must stay out of the middle of the board: a compact plate under the top bar.
    const plate = await page.evaluate(() => {
      showBanner('Your move', 'Turn 1 of 30');
      const b = document.querySelector('#banner').getBoundingClientRect();
      const s = document.querySelector('#stage').getBoundingClientRect();
      return {
        top: (b.top - s.top) / s.height,
        bottom: (b.bottom - s.top) / s.height,
        wide: b.width / s.width
      };
    });
    ok(
      plate.top >= 0 && plate.bottom < 0.2 && plate.wide < 0.7,
      'announcements sit under the top bar, clear of the board'
    );

    await page.keyboard.press('Enter');
    await page.waitForFunction(() => G.turn === 2 && !busy, null, { timeout: 60_000 });
    ok(true, 'End turn runs the rivals and comes back on turn 2');

    for (const [btn, ov, closeBtn] of [
      ['#techBtn', '#techOv', '#techClose'],
      ['#helpBtn', '#helpOv', '#helpClose'],
      ['#menuBtn', '#menuOv', '#menuClose']
    ]) {
      await page.click(btn);
      const open = await page.locator(ov).isVisible();
      await page.click(closeBtn);
      ok(open && !(await page.locator(ov).isVisible()), `${ov} opens and closes`);
    }

    await page.reload();
    await page.waitForSelector('#resumeBtn');
    ok(
      await page.locator('#resumeBtn').isVisible(),
      'the game was saved and can be resumed after a reload'
    );
  }
  ok(
    errors.length === 0,
    `no console errors${errors.length ? ':\n  ' + [...new Set(errors)].join('\n  ') : ''}`
  );
} catch (e) {
  failed = true;
  console.error(`✗ ${e.message}`);
  if (errors.length) console.error('  console:\n  ' + [...new Set(errors)].join('\n  '));
} finally {
  await close();
}
process.exit(failed ? 1 : 0);
