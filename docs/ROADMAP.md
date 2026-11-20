# Roadmap and known issues

What is wrong, what is missing, and what would be fun. Nothing here is promised.

- [Known issues](#known-issues)
- [Balance](#balance)
- [Not verified](#not-verified)
- [Next](#next)
- [Later](#later)
- [Probably never](#probably-never)

## Known issues

These are real, current and worth knowing before you file them.

| Issue                                     | Detail                                                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verdant is overtuned**                  | The AI wins about half of four-way games as the Verdant Lattice. See [Balance](#balance).                                                                  |
| **Rivals ignore fog of war**              | They know where every city is from turn one and can fire at anything in range. It is their only cheat, and it is documented, but it is still a cheat.      |
| **The board needs a pointer**             | There is no keyboard cursor for tiles. Buttons and shortcuts work from the keyboard; moving and attacking do not.                                          |
| **No sound**                              | None at all. Not muted: absent.                                                                                                                            |
| **One save slot**                         | There is one saved game. Abandoning it from the menu asks twice; starting a new game from the title screen while a save exists replaces it without asking. |
| **The AI does not retreat or coordinate** | Each rival unit acts alone, in creation order, and wounded units keep fighting.                                                                            |
| **Stale CSS**                             | `styles.css` still carries some rules from earlier layouts that nothing uses. Harmless, but it makes the file longer than the interface it describes.      |
| **Pinned to three.js r147**               | The last release with script-tag builds of the post-processing add-ons. Moving on means adopting a bundler. See [RENDERING.md](RENDERING.md#why-r147).     |

## Balance

`npm run balance -- 1000` plays a thousand four-way games with the AI in every seat. A fair
table would be 25% each. The table as of version 0.11.0:

| Culture         | Win rate | Average score |
| --------------- | :------: | :-----------: |
| Helion Concord  |  25.1%   |     1082      |
| Verdant Lattice |  51.8%   |     1683      |
| Null Choir      |  10.7%   |      849      |
| Tidewrights     |  12.4%   |      829      |

About 35% of those games end by conquest; the rest go to the clock, at an average of 27
turns.

What this does and does not show:

- It measures the cultures **as the AI plays them**. The AI fights constantly and never
  retreats, which is the best possible case for Regrowth (2 HP back every turn, even after
  attacking) and wastes Tideborn on maps without much water.
- It does not measure a human player. A person who uses Skimmers to grab outposts early, or
  focuses fire, plays a different game.
- The gap is still far too large to wave away. Verdant winning twice as often as the next
  culture is a balance bug.

Ideas, cheapest first. Each is a one-line change in `rules.js`, and `npm run balance` will
say within a minute whether it helped:

1. Regrowth heals **1** instead of 2 for a unit that acted this turn.
2. Regrowth only applies inside Verdant borders.
3. Fabricators takes 1 off research costs too, or lowers the floor so Troopers cost 1.
4. Tideborn also grants +1 sight from liquid tiles, so it does something on dry maps.

A fix should come with a test that pins the new rule and an updated table here.

## Not verified

Things that have been built but not properly measured or tested. Treat claims about them
with suspicion until someone checks.

- **Frame rate on real hardware.** Development and automated checks ran in a software
  renderer. The adaptive quality system exists because phones are expected to struggle, but
  nobody has profiled a real one.
- **Touch gestures.** Pinch, two-finger twist and drag are implemented and have not been
  exercised by an automated test or on a wide range of devices.
- **Safari and Firefox.** The automated checks run in Chromium only.
- **Color contrast.** Tuned by eye, not audited.
- **Long sessions.** Per-game GPU resources are disposed when a game ends; nobody has
  watched memory across twenty games in one tab.

## Next

Small, clearly useful, and unblocked.

- [ ] Fix the Verdant balance problem (see above).
- [ ] A keyboard cursor: arrow keys move a tile highlight, `Enter` clicks it. All the logic
      is already behind `clickTile()`.
- [ ] Run the browser smoke test in CI.
- [ ] Prune unused CSS, with a coverage report to prove what is unused.
- [ ] Make rivals respect fog of war for targeting at least, and see what it does to
      difficulty.
- [ ] A difficulty setting. The cheapest version is a flux multiplier for rivals; the better
      version is AI that retreats wounded units.
- [ ] Publish to GitHub Pages on every tagged release.

## Later

Bigger, and each one changes the character of the game a little.

- [ ] **Sound.** Synthesized with the Web Audio API, to keep the "no asset files" rule.
      A hum per sky, a tick per move, something satisfying for a capture.
- [ ] **Multiple save slots**, and a way to export a save as a file.
- [ ] **Seeded maps.** The tests already run on a seeded generator; expose a seed on the
      setup screen so two people can play the same board.
- [ ] **Hot-seat multiplayer.** The rules are already symmetric. It needs per-player fog on
      the renderer side and a "pass the device" screen.
- [ ] **A replay.** `G` is small and serializable; record it each turn and play the war
      back at the end.
- [ ] **A text interface** over the same rules, for screen readers and for fun.
- [ ] **Move to current three.js.** Means ES modules and a bundler that can still emit one
      inline script. Worth it if WebGPU or newer post-processing becomes interesting.
- [ ] **More hardware.** A Medic, a transport, something that flies.

## Probably never

- **Online multiplayer.** There is no server, and that is a feature.
- **Accounts, telemetry, ads.** The game does not know who you are and would like to keep
  it that way.
- **A fifth resource.** There is one currency. One is the right number of currencies.
