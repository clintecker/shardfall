# Shardfall: notes for Claude

A single-page, turn-based strategy game. Plain JavaScript, no framework, no bundler, three.js
r147 from a CDN. Read `docs/ARCHITECTURE.md` before changing structure and `docs/RENDERING.md`
before touching anything in `src/js/gfx/`.

## Commands

- `npm run verify` — format check, static checks, tests, build. Run before every commit.
- `npm test` — rules, map generation and whole-game simulations (Node only, ~3 s).
- `npm run format` — Prettier. Run after editing; CI checks formatting.
- `npm run dev` — serve the source at http://localhost:5173.
- `npm run balance -- 1000` — AI-only win rates per culture. Run after any rules change.
- `npm run test:e2e` / `npm run screenshots` — need Playwright and take minutes in software GL.

## Rules of the codebase

- **Classic scripts, one global scope.** No `import`/`export` in `src/`. A new file needs a
  `<script>` tag in `index.html` in the right order; `npm run check` enforces it.
- **The logic layer is headless.** `data.js`, `world.js`, `rules.js`, `ai.js`, `input.js` must
  not touch the DOM or three.js. To make the screen react, push onto `fx` or call `mark()`.
- **Only `main.js` executes at load time.** Everything else declares.
- **Every WebGL color goes through `lin()`** (r147 legacy color mode).
- **Rules, docs and tests move together.** A changed number changes `src/js/rules.js` or
  `data.js`, `test/rules.test.mjs` and `docs/GAMEPLAY.md` in the same commit.
- **Do not bump three.js.** It is pinned to 0.147.0 in `index.html` and `package.json` on
  purpose.
- Add a line to `CHANGELOG.md` under Unreleased for anything a player would notice.

## The published artifact

The game is also published as a Claude artifact:
https://claude.ai/artifact/Uv186B8dtPj42P5njqfAgL

To update it: `npm run verify`, then publish `dist/shardfall.artifact.html` with the Artifact
tool, passing that URL so the existing artifact is updated in place. Never hand-edit the
built file. The artifact host only allows scripts from a few CDNs (`npm run check` enforces
the list) and a 16 MB page.

## Verifying visual work

There are no rendering unit tests. After a visual change, run `npm run test:e2e`, take
screenshots at desktop and phone width (`test/e2e/browser.mjs` has the launch flags that
make WebGL work headlessly), and look at them. CSS animations finish before a slow software
renderer can capture them: pause them with an injected style when screenshotting a transient
element.
