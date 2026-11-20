// The build is string concatenation, so these tests are mostly about the promises the output
// has to keep for its two hosts: a plain web page, and a Claude artifact (which has a CSP, a
// size limit and its own document skeleton).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';
import { check } from '../scripts/check.mjs';
import { ALLOWED_SCRIPT_HOSTS } from '../scripts/lib/manifest.mjs';

const out = await build();

test('static checks pass: every source file is loaded once and the bundle is one valid script', async () => {
  const { problems, files } = await check();
  assert.deepEqual(problems, []);
  assert.ok(files >= 20);
});

test('the build is deterministic', async () => {
  const again = await build();
  assert.equal(again.artifact, out.artifact);
  assert.equal(again.standalone, out.standalone);
});

test('the artifact is a fragment: a title, no document skeleton, one inline script', () => {
  const a = out.artifact;
  assert.ok(a.startsWith('<title>Shardfall</title>\n'));
  assert.doesNotMatch(
    a,
    /<(?:!doctype|html|head|body)[\s>]/i,
    'the artifact host supplies the skeleton'
  );
  assert.equal(a.match(/<script>/g).length, 1);
  assert.equal(a.match(/<\/script>/g).length, 1 + out.manifest.vendor.length);
  assert.equal(a.match(/<style>/g).length, 1);
  assert.ok(a.includes('<meta name="claude:viewport-fit-sides" content="cover">'));
  assert.ok(Buffer.byteLength(a) < 16 * 1024 * 1024, 'artifacts are limited to 16 MB');
});

test('the standalone page is a complete document with the same game inside', () => {
  const s = out.standalone;
  assert.ok(s.startsWith('<!doctype html>\n<html lang="en">'));
  assert.ok(s.trimEnd().endsWith('</html>'));
  assert.ok(s.includes('<meta name="viewport"'));
  assert.ok(s.includes(out.js));
  assert.ok(out.artifact.includes(out.js));
});

test('external scripts are pinned and come only from hosts an artifact may load', () => {
  const urls = [...out.artifact.matchAll(/<script src="([^"]+)">/g)].map(m => m[1]);
  assert.equal(urls.length, 9);
  for (const u of urls) {
    assert.ok(ALLOWED_SCRIPT_HOSTS.includes(new URL(u).host), u);
    assert.match(
      u,
      /three@0\.147\.0\//,
      'three.js is pinned to r147, the last line with UMD builds of the examples'
    );
  }
  assert.match(urls[0], /build\/three\.min\.js$/, 'the core library loads before its add-ons');
  const other = [...out.artifact.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map(
    m => new URL(m[1]).host
  );
  assert.deepEqual([...new Set(other)].sort(), ['cdn.jsdelivr.net', 'fonts.googleapis.com']);
});

test('the bundle keeps every source file, in manifest order, under one strict-mode directive', () => {
  assert.ok(out.js.startsWith("'use strict';\n"));
  assert.equal(out.js.match(/^'use strict';$/gm).length, 1);
  let at = -1;
  for (const src of out.manifest.sources) {
    const next = out.js.indexOf(`/* ━━ ${src} ━━ */`);
    assert.ok(next > at, `${src} is missing or out of order`);
    at = next;
  }
  assert.doesNotThrow(() => new vm.Script(out.js));
});

test('the markup carries every element the scripts look up by id', () => {
  const ids = new Set([...out.manifest.markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const wanted = new Set([...out.js.matchAll(/\$\('#([A-Za-z][\w-]*)'\)/g)].map(m => m[1]));
  const missing = [...wanted].filter(id => !ids.has(id));
  assert.deepEqual(missing, [], `scripts query ids the page does not have: ${missing}`);
  assert.ok(wanted.size > 30);
});
