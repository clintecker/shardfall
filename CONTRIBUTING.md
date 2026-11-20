# Contributing to Shardfall

Thank you for being here. Bug reports, balance arguments, new skies, better AI and typo
fixes are all welcome.

## The two-minute version

```bash
git clone https://github.com/clintecker/shardfall.git
```

```bash
cd shardfall && npm install
```

```bash
npm run dev
```

Change something under `src/`, reload the browser, and before you push:

```bash
npm run verify
```

That runs the formatter check, the static checks, the tests and the build: the same four
things CI runs. If it passes locally it will pass there.

[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) has the long version, including recipes for
adding a unit, a technology or a whole culture.

## Before you start something big

Open an issue first and say what you have in mind. The game is small on purpose, and "this
is great but it is a different game" is a much nicer conversation before the work than after
it. [docs/ROADMAP.md](docs/ROADMAP.md) lists what is already wanted, and what is not.

Small fixes need no ceremony. Just send them.

## What a good change looks like

**It does one thing.** A pull request that fixes a bug and also reformats a file and also
renames a function is three pull requests.

**Rules, docs and tests agree.** If you change a number or a rule:

- the code in `src/js/rules.js` (or `data.js`) changes,
- the test that pins it in `test/rules.test.mjs` changes,
- the sentence that describes it in `docs/GAMEPLAY.md` changes.

A reviewer will check all three. If the rule affects balance, paste the output of
`npm run balance -- 1000` before and after.

**Visual changes come with pictures.** A before and an after, at desktop and phone width.
If you changed anything that moves, say that you checked it with "reduce motion" turned on.

**The logic layer stays headless.** Nothing in `data.js`, `world.js`, `rules.js`, `ai.js` or
`input.js` may touch the DOM or three.js. The test suite loads those files with no browser,
and will tell you.

**It leaves a line in the changelog.** Under **Unreleased** in `CHANGELOG.md`, written for
a player, not a developer: what is different, not which function moved.

## Commit messages

Imperative, present tense, and about the effect: "Keep the ore ridge off the capital road",
not "fixed bug" or "update world.js". If the why is not obvious from the what, the body of
the message is the place for it.

## Reporting bugs

Use the bug report form. The things that make a report fixable:

- what you did, what happened, and what you expected,
- board size, number of rivals, terrain, sky, your culture, and the turn,
- your browser and device (and GPU, for anything visual),
- a screenshot, and anything red in the browser console.

For rules bugs, the save file is gold. In the console:

```js
copy(localStorage.getItem('shardfall-save-v1'));
```

and paste the result into the issue.

## Conduct

Be kind, be specific, and assume the person on the other end is doing their best. Criticize
code and ideas as hard as you like; do not criticize people. Harassment, slurs and personal
attacks get you removed from the project.

## Licensing

Shardfall is MIT licensed. By contributing, you agree that your contribution is too.
