# Radar

A daily visual briefing (game dev + AI engineering) published at toamig.com/radar/.
Astro static site on GitHub Pages; a Claude Code routine writes one issue a day.

- The morning run follows `routine/PROMPT.md`; the kit it composes from is `routine/FORMATS.md`.
  Change those two files to change what the run does. Keep them in sync with `src/kit/schema.mjs`.
- Issue text is plain text with `**bold**`, `` `code` `` and `[label](https://url)` only, rendered
  escaped by `src/kit/inline.ts`. Never add a path that renders issue content as HTML.
- Colors only come from `src/kit/catalog.mjs` ids. Never let an issue set raw colors.
- Art SVGs are shown via `<img>`; bespoke pages run in `sandbox="allow-scripts"` frames without
  allow-same-origin. `scripts/validate.mjs` enforces both; keep those checks strict.
- Retention is part of the design: 7 daily issues, 4 weeks (`scripts/prune.mjs`, `src/kit/data.ts`).
- After changing the kit, run `npm run validate && npm run build && npm run shoot` and look at
  the screenshots in `.cache/shots/`.
- Never write the em dash or en dash characters in anything (copy, comments, commits).
- Commits carry no attribution: never add a `Co-Authored-By` or `Claude-Session` trailer, in any
  session or routine. `.claude/settings.json` turns it off and `.githooks/commit-msg` strips it
  (run `git config core.hooksPath .githooks` once per checkout).
- The look lives in `src/styles/future.css` ("Prism": white cards in Geist, follows the system theme with a
  masthead toggle). Lanes carry fixed colors (game dev coral, software and AI blue, both teal) on every card; the day's two
  inks drive the hero glow, the headline bar and the section frames. It is loaded last and re-skins the older stylesheets.
  `src/kit/catalog.mjs` lifts or sinks each ink until it reads (4.5:1).
