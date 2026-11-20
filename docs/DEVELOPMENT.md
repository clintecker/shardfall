# Development

Everything you need to change Shardfall and ship the change.

- [Setup](#setup)
- [Commands](#commands)
- [The edit loop](#the-edit-loop)
- [House style](#house-style)
- [Recipes](#recipes)
  - [Adding a source file](#adding-a-source-file)
  - [Changing a number](#changing-a-number)
  - [Adding a unit](#adding-a-unit)
  - [Adding a technology](#adding-a-technology)
  - [Adding a culture](#adding-a-culture)
- [Checking visual changes](#checking-visual-changes)
- [Shipping](#shipping)
- [Troubleshooting](#troubleshooting)

## Setup

You need [Node.js](https://nodejs.org/) 20 or newer. That is the whole list.

```bash
git clone https://github.com/clintecker/shardfall.git
```

```bash
cd shardfall
```

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:5173>. You are playing the source files directly; there is nothing
to compile.

`npm install` fetches two development tools: Prettier (formatting) and a local copy of
three.js r147 (so the dev server and tests work offline). Neither ships with the game.

**No Node at all?** Double-click `index.html`. It loads three.js from the CDN and runs from
`file://`. You lose the tests and the formatter, not the game.

## Commands

| Command               | What it does                                                                 |
| --------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`         | Serves the repo at `localhost:5173`. No watcher needed: just reload          |
| `npm test`            | Unit tests and whole-game simulations. About three seconds                   |
| `npm run check`       | Static checks: every file loaded once, no name collisions, pinned CDN        |
| `npm run build`       | Writes `dist/index.html` and `dist/shardfall.artifact.html`                  |
| `npm run verify`      | Format check, static checks, tests and build: exactly what CI runs           |
| `npm run format`      | Rewrites everything with Prettier                                            |
| `npm run balance`     | Plays 200 AI-only games and prints win rates per culture                     |
| `npm run test:e2e`    | Browser smoke test. Needs Playwright ([see below](#checking-visual-changes)) |
| `npm run screenshots` | Regenerates `docs/media/` from the running game. Needs Playwright            |

Dev server options: `npm run dev -- --port 8080` picks a port, and `npm run dev -- --cdn`
loads three.js from jsDelivr instead of `node_modules`, which is what players get.

## The edit loop

1. Edit a file under `src/`.
2. Reload the browser.
3. Before you commit: `npm run verify`.

There is no step where something is compiled, bundled or cached. If the browser shows old
behavior, it is the browser's cache; the dev server sends `Cache-Control: no-store` to
prevent exactly that.

The game saves to `localStorage` after every turn, so a reload drops you back on the title
screen with **Resume** available. That makes "play to turn 12, tweak the mech, reload,
resume" a fast way to work on something that only shows up mid-game. If a change to the
shape of `G` makes old saves crash, clear the save from the console:

```js
localStorage.removeItem('shardfall-save-v1');
```

Every top-level name in the source is a global, so the console is the debugger. Some useful
incantations:

```js
G.factions[0].flux = 99; // be rich
G.factions[0].explored.fill(1); // see everything
Object.keys(TECHS).forEach(k => (G.factions[0].techs[k] = 1)); // know everything
spawn(0, 'mech', 5, 5, false); // conjure a Mech (the tile should be empty)
ui(); // redraw the interface after poking at state
await aiTurn(0); // let the AI play your turn
```

More renderer-specific ones are in [RENDERING.md](RENDERING.md#poking-at-it).

## House style

**Formatting is Prettier's problem.** Run `npm run format` and do not think about it. CI
checks it.

**Plain scripts, one global scope.** No `import`, no `export`. Read
[ARCHITECTURE.md](ARCHITECTURE.md#one-global-scope-on-purpose) for why, and for the three
rules that keep it sane. The short version: declare at the top level, execute only in
`main.js`, and keep rule code free of DOM and three.js calls.

**The logic layer stays headless.** `data.js`, `world.js`, `rules.js`, `ai.js` and
`input.js` are loaded by the tests with no browser. If you need the screen to react to a
rule, push a record onto `fx` or call `mark()`, and let the renderer pick it up.

**Colors go through `lin()`.** In anything WebGL, never hand a raw hex string to a material.
See [RENDERING.md](RENDERING.md#why-r147).

**Rules, docs and tests move together.** `docs/GAMEPLAY.md` is a promise to players and
`test/rules.test.mjs` is how the promise is kept. A change to a number is a change to all
three.

**Every file starts with a comment that says what it is for.** If you add a file, write one.
If you change what a file is for, update it.

**Comments explain why.** The code is terse in places, especially in `gfx/`. A comment that
says what the next line does is noise; a comment that says why it has to be that way is the
most valuable thing in the file.

## Recipes

### Adding a source file

1. Create it under `src/js/`, starting with `'use strict';` and a header comment.
2. Add a `<script src="...">` tag to `index.html`, placed after every file it needs at load
   time.
3. Run `npm run check`. It fails if the file is on disk but not loaded, loaded twice, or
   declares a top-level name that another file already uses.

If the file is game logic that the tests should load, also add it to `LOGIC` in
`test/helpers/sandbox.mjs`.

### Changing a number

Unit stats are in `UT`, technology definitions in `TECHS`, culture traits in `CULTURES`, all
in [`src/js/data.js`](../src/js/data.js). Formulas (damage, income, costs, supply, healing)
are short functions at the top of [`src/js/rules.js`](../src/js/rules.js).

After changing one:

```bash
npm test
```

A test will fail, because the old number is pinned. Update the test and
[GAMEPLAY.md](GAMEPLAY.md) to the new truth. Then see what you did to the table:

```bash
npm run balance -- 1000
```

A fair four-way game is 25% each. The current state of that table is in
[ROADMAP.md](ROADMAP.md#balance).

### Adding a unit

A unit is data, a model and a portrait. Suppose you want a Medic.

1. **Stats.** Add a row to `UT` in `data.js`:

   ```js
   medic: { name: 'Medic', cost: 4, hp: 8, atk: 1, def: 1, mov: 1, rng: 1, tech: 'nanomed' }
   ```

   That alone makes it trainable (by anyone with the tech), listed in the help table, and
   available to the AI. Units without special rules need no rule code.

2. **Special behavior**, if any, goes in `rules.js`. A healing aura would be a few lines in
   `finishTurn()`. Write the test first.

3. **Model.** Add a branch for `'medic'` in `unitGeo()` in `gfx/models.js`, and a row in
   `RIG` in `gfx/units.js` so it animates. Do not skip the `RIG` row: the renderer looks it
   up for every unit, and the first frame with a Medic on the board will throw without it.
   [RENDERING.md](RENDERING.md#characters-that-animate-themselves) explains the builder.

4. **Portrait.** Nothing to do. Portraits are rendered from the model.

5. **Docs.** Add it to the unit table in [GAMEPLAY.md](GAMEPLAY.md#units) and the hardware
   table in [WORLD.md](WORLD.md#the-hardware). Run `npm run screenshots -- roster`.

The data test asserts that exactly one unit needs no tech; if your new unit is free from the
start, that test wants a word.

### Adding a technology

Add an entry to `TECHS` in `data.js`:

```js
terraform: { name: 'Terraforming', tier: 3, br: 0, req: 'nanomed', desc: 'Turn flats into groves' }
```

`br` is the branch (0 Growth, 1 Mobility, 2 Firepower, 3 Industry) and `req` is the tech
below it. The research overlay lists each branch's techs in tier order, however many there
are, and the rivals' wish list is built from the table, so both pick up a new entry on
their own.

The data test currently asserts a strict 4 × 3 tree (one tech per branch per tier). A fourth
tier, or a second tech on a tier, means relaxing that test on purpose.

Then implement what it does, wherever the rule lives. Rules check for techs like this:

```js
if (f.techs.terraform) {
  /* ... */
}
```

### Adding a culture

The biggest job, because a culture is a color, a trait, a wardrobe and a landscape.

1. `CULTURES` in `data.js`: key, name, color, starting tech, trait name and text, blurb.
2. `TNAME` and `HOME` in `data.js`: what it calls the four terrains and its homeland.
3. The trait itself, in `rules.js`. Existing traits are one-line checks on
   `G.factions[i].key` (search for `'helion'` to see the pattern).
4. `PAL` in `gfx/models.js`: its unit palette. Plus `head()` and `kit()` branches if it
   should have its own silhouette, which it should.
5. `BIO` in `gfx/biomes.js`: its homeland.
6. A paragraph in [WORLD.md](WORLD.md). Hold it to the
   [design notes](WORLD.md#design-notes) there.

A game has at most four sides (one per corner), so a fifth culture means some are left out
of each game. `newGame()` already picks rivals at random from whichever cultures the player
did not choose. The data tests that count cultures will need updating.

## Checking visual changes

Rendering has no unit tests. It has a smoke test, a screenshot script, and your eyes.

Both scripts drive a real browser through [Playwright](https://playwright.dev/), which is
deliberately not a dependency of this repo (it is large, and the unit tests do not need it):

```bash
npm install --no-save playwright
```

```bash
npx playwright install chromium
```

Then:

```bash
npm run test:e2e
```

loads the source page and the built page, starts a game on each, plays a turn through the
real input path, opens every overlay, reloads to check the save, and fails on any console
error.

```bash
npm run screenshots
```

replays seeded games and rewrites every image in `docs/media/`. Pass a prefix to do only
some: `npm run screenshots -- skies`.

Both work without a GPU by using Chromium's software renderer, which is **slow**: allow
several minutes. That is the renderer, not the game.

When you change how something looks, check by hand:

- [ ] at desktop width and at phone width (about 400 px),
- [ ] under at least two different skies (a dark one and Cloud Dawn),
- [ ] in at least two homelands,
- [ ] with the operating system's "reduce motion" setting on,
- [ ] at **Low** quality (menu), which turns off bloom,
- [ ] in more than one browser if you touched a shader. Safari's WebGL has opinions.

## Shipping

```bash
npm run verify
```

builds the two files in `dist/`. They are the same game in two wrappers.

**Anywhere on the web.** `dist/index.html` is a complete page. Put it on any static host:
GitHub Pages, Netlify, an S3 bucket, a USB stick. It needs to reach `cdn.jsdelivr.net` for
three.js and `fonts.googleapis.com` for two typefaces (it falls back to system fonts without
them).

**As a Claude artifact.** `dist/shardfall.artifact.html` is the fragment format artifacts
expect: a `<title>`, then styles, markup and script, with no `<html>`, `<head>` or `<body>`.
In a Claude Code session, ask Claude to publish that file as an artifact, or to update the
existing one by passing its URL. The file must stay under 16 MB (it is about a quarter of
one) and may only load scripts from the CDNs the artifact host allows; `npm run check`
enforces the second.

**Releases.** Bump `version` in `package.json`, move the **Unreleased** notes in
`CHANGELOG.md` under the new version and date, commit, and tag `vX.Y.Z`. The version is
stamped into a comment at the top of both built files.

## Troubleshooting

**The board says "This game draws its board with WebGL, which this browser or device is not
providing."** One of two things. Open the console:

- `3D library did not load` means the CDN is unreachable (offline, firewall, content
  blocker). Run `npm install` and use `npm run dev`, which serves three.js from
  `node_modules` instead.
- Anything else means WebGL itself is unavailable or disabled. Check `chrome://gpu` or the
  equivalent; hardware acceleration may be turned off in the browser's settings.

**Everything is washed out and too bright.** A color skipped `lin()`, or tone mapping got
applied twice. See [RENDERING.md](RENDERING.md#why-r147).

**`npm run check` says a name is already declared.** Two files declare the same top-level
`const`, `let` or function. Rename one. In a browser this would have been a runtime error on
load; the check exists to tell you sooner.

**A test fails with `X is not defined`.** A logic-layer file called a function that lives in
the presentation layer. Either the call belongs in `ui.js`, or it is a legitimate
notification and needs a stub in `test/helpers/sandbox.mjs` (there are six; think hard
before adding a seventh).

**The smoke test times out waiting for the first frame.** Software rendering under load.
Run it on its own, not alongside the screenshot script.

**The game runs at 20 fps in my headless browser.** Yes.
