// Shared Playwright plumbing for the smoke test and the screenshot script.
//
// Playwright is deliberately NOT a dependency of this repo: it is ~300 MB with its browser, and
// the unit tests cover the rules without it. Bring your own:
//
//   npm install --no-save playwright && npx playwright install chromium
//
// The flags below make WebGL work in a headless browser with no GPU (CI, containers) by using
// the SwiftShader software renderer. It is slow, which is why the page is told to keep its
// quality setting instead of adapting down.
import { createRequire } from 'node:module';
import { serve } from '../../scripts/serve.mjs';

export const GL_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl'
];

export function loadPlaywright() {
  try {
    // createRequire so globally installed copies (NODE_PATH) are found too.
    return createRequire(import.meta.url)('playwright');
  } catch {
    console.error(
      'Playwright is not installed.\n  npm install --no-save playwright && npx playwright install chromium'
    );
    process.exit(2);
  }
}

/** Launches Chromium and the dev server. Returns helpers; call close() when done. */
export async function launch({
  viewport = { width: 1280, height: 800 },
  deviceScaleFactor = 1,
  seed = null
} = {}) {
  const { chromium } = loadPlaywright();
  const { server, url, localThree } = await serve({ port: 0 });
  if (!localThree) console.warn('node_modules/three not found: the page will try the CDN');
  const browser = await chromium.launch({ args: GL_ARGS });
  const page = await browser.newPage({ viewport, deviceScaleFactor });
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    // SwiftShader warns about slow GPU readbacks; that is the renderer, not the game.
    if (m.type() === 'error' || (m.type() === 'warning' && !/ReadPixels/.test(m.text())))
      errors.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  // Google Fonts may be unreachable in a sandbox; answer with an empty stylesheet so a blocked
  // font host can neither stall a run nor show up as a console error. System fonts take over.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' })
  );
  await page.addInitScript(seed => {
    window.__keepQuality = true;
    if (seed === null) return;
    // A seeded Math.random (mulberry32) so the same script always produces the same map.
    let a = seed >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
  const close = async () => {
    await browser.close();
    await new Promise(r => server.close(r));
  };
  return { page, url, errors, close };
}

/** Waits until the first WebGL frame of a started game has been drawn. */
export async function firstFrame(page, timeout = 60_000) {
  await page.waitForFunction(
    () => document.querySelector('#veil')?.classList.contains('off'),
    null,
    {
      timeout
    }
  );
}
