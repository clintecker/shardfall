#!/usr/bin/env node
// Static checks that catch the ways a no-bundler, shared-global-scope project usually breaks.
// Runs in well under a second and needs nothing but Node.
//
//   1. every file in src/js is loaded by index.html exactly once, and every loaded file exists
//   2. every source file parses on its own
//   3. the concatenated bundle parses as ONE script. Classic scripts share a global scope, so a
//      second top-level `const x` in another file is a runtime error in the browser; as a single
//      script it is a SyntaxError here, before anything ships
//   4. vendor scripts come from hosts the artifact CSP allows and are pinned to exact versions
//   5. nothing in the source can terminate the inline <script>/<style> early
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { ALLOWED_SCRIPT_HOSTS, fromRoot, loadManifest, read } from './lib/manifest.mjs';
import { build } from './build.mjs';

async function walk(dir) {
  const out = [];
  for (const e of await readdir(fromRoot(dir), { withFileTypes: true })) {
    const p = path.posix.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

export async function check() {
  const problems = [];
  const m = await loadManifest();

  const onDisk = (await walk('src/js')).sort();
  const listed = m.sources;
  for (const f of onDisk) {
    const n = listed.filter(s => s === f).length;
    if (n === 0) problems.push(`${f} exists but index.html never loads it`);
    if (n > 1) problems.push(`${f} is loaded ${n} times by index.html`);
  }
  for (const f of listed)
    if (!onDisk.includes(f)) problems.push(`index.html loads ${f}, which does not exist`);

  for (const f of onDisk) {
    try {
      new vm.Script(await read(f), { filename: f });
    } catch (e) {
      problems.push(`${f}: ${e.message}`);
    }
  }

  for (const u of m.vendor) {
    const { host, pathname } = new URL(u);
    if (!ALLOWED_SCRIPT_HOSTS.includes(host))
      problems.push(`vendor script host not allowed in an artifact: ${u}`);
    if (!/@\d+\.\d+\.\d+\//.test(pathname) && !/\/\d+\.\d+\.\d+\//.test(pathname))
      problems.push(`vendor script is not pinned to an exact version: ${u}`);
  }

  if (!problems.length) {
    try {
      const { js } = await build();
      new vm.Script(js, { filename: 'bundle.js' });
    } catch (e) {
      problems.push(`bundle: ${e.message}`);
    }
  }
  return { problems, files: onDisk.length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { problems, files } = await check();
  if (problems.length) {
    console.error(problems.map(p => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  console.log(
    `✓ ${files} source files: all loaded once, all parse, bundle is one valid script, vendor pins OK`
  );
}
