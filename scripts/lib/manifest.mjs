// Reads index.html as the build manifest: which vendor scripts, which stylesheets,
// which markup and which source files (in which order) make up the game.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const fromRoot = (...p) => path.join(ROOT, ...p);
export const read = (...p) => readFile(fromRoot(...p), 'utf8');

/** Hosts a Claude artifact is allowed to load scripts from (its CSP blocks everything else). */
export const ALLOWED_SCRIPT_HOSTS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdn.tailwindcss.com',
  'code.jquery.com'
];

const APP_START = '<!-- app:start -->';
const APP_END = '<!-- app:end -->';

export async function loadManifest() {
  const page = await read('index.html');
  const pkg = JSON.parse(await read('package.json'));

  const title = (page.match(/<title>([^<]*)<\/title>/) || [])[1];
  if (!title) throw new Error('index.html has no <title>');

  const a = page.indexOf(APP_START);
  const b = page.indexOf(APP_END);
  if (a < 0 || b < a) throw new Error(`index.html needs ${APP_START} … ${APP_END} markers`);
  const markup = dedent(page.slice(a + APP_START.length, b));

  const scriptSrcs = [...page.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map(m => m[1]);
  const vendor = scriptSrcs.filter(s => /^https?:/.test(s));
  const sources = scriptSrcs.filter(s => !/^https?:/.test(s));

  const links = [...page.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g)].map(
    m => m[1]
  );
  const fonts = links.filter(s => /^https?:/.test(s));
  const styles = links.filter(s => !/^https?:/.test(s));

  return { page, pkg, title, markup, vendor, sources, fonts, styles };
}

function dedent(block) {
  const lines = block.replace(/^\n+|\s+$/g, '').split('\n');
  const pad = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
  return lines.map(l => l.slice(pad)).join('\n');
}
