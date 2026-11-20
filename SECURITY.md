# Security

Shardfall is a static web page. It has no server, no accounts and no network traffic of its
own; it stores a saved game and three settings in your browser's `localStorage` and nothing
anywhere else.

That leaves a small surface, but not an empty one:

- **Third-party scripts.** The game loads three.js from jsDelivr, pinned to an exact version.
- **Saved games.** A save is parsed from `localStorage` on load. A deliberately malformed
  save should fail safely, not run code.
- **The build and development scripts** in `scripts/`, which run on a contributor's machine.

If you find a problem in any of these, please report it privately through GitHub's
**Report a vulnerability** button on the repository's Security tab, not in a public issue.
You should hear back within a week.
