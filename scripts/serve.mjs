#!/usr/bin/env node
// A tiny static server for development. Zero dependencies.
//
//   npm run dev                 serve the repo at http://localhost:5173
//   npm run dev -- --port 8080  pick a port
//   npm run dev -- --cdn        load three.js from the CDN even if node_modules/three exists
//
// By default, when `npm install` has put three@0.147.0 in node_modules, the CDN <script> tags in
// any served HTML are rewritten to that local copy so the game runs offline and behind firewalls.
// The files on disk are never changed; only the response is.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib/manifest.mjs';

export const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
export const THREE_LOCAL = '/node_modules/three/';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8'
};

export function hasLocalThree() {
  return existsSync(path.join(ROOT, 'node_modules', 'three', 'build', 'three.min.js'));
}

/** Starts the server and resolves with { server, url, localThree }. Port 0 picks a free port. */
export function serve({ port = 5173, host = '127.0.0.1', cdn = false } = {}) {
  const localThree = !cdn && hasLocalThree();
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
      if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const ext = path.extname(file);
      let body = await readFile(file);
      if (ext === '.html' && localThree) body = body.toString().split(THREE_CDN).join(THREE_LOCAL);
      res.writeHead(200, {
        'content-type': TYPES[ext] || 'application/octet-stream',
        'cache-control': 'no-store'
      });
      res.end(body);
    } catch (e) {
      send(res, e.code === 'ENOENT' || e.code === 'ENOTDIR' ? 404 : 500, e.code || String(e));
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      resolve({ server, localThree, url: `http://${host}:${server.address().port}/` });
    });
  });
}

function send(res, code, text) {
  res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--port');
  const port = i >= 0 ? Number(args[i + 1]) : Number(process.env.PORT) || 5173;
  const { url, localThree } = await serve({ port, cdn: args.includes('--cdn') });
  console.log(
    `Shardfall dev server\n  source   ${url}\n  built    ${url}dist/   (after npm run build)`
  );
  console.log(`  three.js ${localThree ? 'node_modules (offline-friendly)' : 'jsDelivr CDN'}`);
}
