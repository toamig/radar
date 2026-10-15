# Radar

A daily visual briefing on game development and AI engineering, researched,
written and laid out by Claude every morning. Live at [toamig.com/radar](https://toamig.com/radar/).

Each issue is "printed" like a risograph zine: two inks on a paper stock, chosen
fresh every day from a contrast-checked catalog, and a layout composed for that
day's stories from a kit of display formats (charts, comparisons, timelines,
step-by-steps, spotlights, quotes, concept explainers, custom art, and the odd
interactive piece). Nothing is kept for more than a week.

## How a day is made

| Time (Lisbon, summer) | Step | Runs on | Cost |
|---|---|---|---|
| 05:37 | **Sweep**: read ~35 sources (feeds, Hacker News, GitHub releases), keep the last 48 hours, drop what was already featured | GitHub Actions, `scripts/sweep.mjs` | free |
| 05:38 | **Triage**: Claude Haiku 5.5 scores every candidate against `editorial/taste.md` | GitHub Actions, `scripts/triage.mjs` | about $0.05, only if `ANTHROPIC_API_KEY` is set |
| 06:07 | **Morning run**: research desks dig in, the editor picks and writes, the art director composes the page, then it validates, screenshots, fixes and pushes | Claude Code routine, `routine/PROMPT.md`: research desks on Sonnet 5.5, editing and layout on Opus 5.5 | Claude Max plan (scheduled runs cannot use cloud session credits) |
| on push | **Deploy**: validate, build, publish to GitHub Pages | GitHub Actions | free |

Both schedules are in UTC (sweep 04:37, routine 05:07), so they read 05:37 and 06:07 in Lisbon summer time and an hour earlier in winter. The routine is managed at [claude.ai/code/routines](https://claude.ai/code/routines).

## Layout

```
data/issues/<date>.json    one issue per day (kept 7 days)
data/weeks/<id>.json       Sunday's weekly summary (kept 4 weeks)
public/art/<date>/         SVG art drawn for that issue
public/bespoke/<date>/     sandboxed interactive pieces
public/og/                 share cards, generated at build by scripts/og.mjs (not committed)
inbox/<date>.json          sweep and triage output
editorial/taste.md         the reader profile: what earns a place
editorial/feedback.md      "more/less like this" feedback, folded in daily
editorial/notebook.md      the run's design memory
routine/PROMPT.md          the morning run's procedure
routine/FORMATS.md         the showcase kit, theme catalog, art and bespoke rules
src/kit/schema.mjs         the issue contract (enforced at validate and build)
src/kit/catalog.mjs        inks, papers, type sets and the contrast rules
config/sources.json        what the sweep reads
```

## Working on it

```bash
npm ci
npm run dev        # http://localhost:4321/radar/
npm run validate   # schema, art safety, layout rows, contrast catalog
npm run build
npm run shoot      # screenshots of the newest issue into .cache/shots/
npm run sweep      # today's inbox, locally
```

## Tuning

- **What gets covered**: edit `editorial/taste.md`, or visit the site once with
  `?tune=1` to show "More like this" / "Less like this" on every story. Those open
  a prefilled GitHub issue; the Feedback workflow records it and the next morning
  run folds it into the profile. Only the repo owner's feedback is used.
- **Where it looks**: edit `config/sources.json`.
- **How it looks**: the kit lives in `src/components/blocks/` and `src/styles/radar.css`.
  New formats need a schema entry, a component and a line in `routine/FORMATS.md`.

## Safety

The morning run reads the open web, so the page it writes is treated as untrusted:
issue text is rendered escaped (no HTML), art is checked SVG shown through `<img>`,
and bespoke pieces run in a sandboxed frame with no same-origin access, no network
and a strict CSP. `npm run validate` enforces all of it before anything deploys.

## Licence

Code: MIT. Issue text summarises and links to its sources, which keep their own rights.
