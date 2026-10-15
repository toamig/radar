# The showcase kit

Everything an issue can be built from. `src/kit/schema.mjs` is the enforced
contract; this file explains when to reach for each piece. If the two ever
disagree, the schema wins and this file is wrong.

## The issue file

`data/issues/<date>.json`:

| Field | What it is |
|---|---|
| `date` | `YYYY-MM-DD`, the Lisbon date of the run. The file name must match. |
| `number` | Previous issue number + 1. |
| `title` | The day's headline phrase, at most 90 characters. Says what the day was about. |
| `dek` | One or two sentences under the title, at most 260 characters. |
| `theme` | Inks, paper, text ink and type set for the day (see Theme). |
| `tldr` | 3 to 5 `{ text, lane }` lines: the whole issue in thirty seconds. |
| `blocks` | 4 to 14 blocks. The first is always the hero. 9 to 12 is the sweet spot. |
| `ticker` | Up to 14 one-line briefs `{ text, lane, url, source }` for "Also moving". |
| `sparks` | 3 to 6 rising games, concepts and techniques (see Sparks). Shown after the grid. |
| `lab` | 1 to 3 research results (see The lab). Shown after Sparks. |
| `note` | Optional colophon line about how the day was put together. |

## Inline text

Every text field accepts `**bold**`, `` `code` `` and `[label](https://url)`.
Nothing else is rendered: no HTML, no other Markdown. Use bold sparingly, for the
one phrase a skimming reader must not miss.

## Every block

| Field | Notes |
|---|---|
| `id` | Lowercase slug, unique in the issue. Also seeds the generated art. |
| `format` | One of the formats below. |
| `lane` | `gamedev`, `ai` or `both`. Shown as a glyph: a plus for game dev, a spark for AI. |
| `importance` | 1 headline (hero only), 2 feature, 3 standard, 4 minor. 1 and 2 get bigger titles and a full-width ink bar. |
| `size` | `full` 6 columns, `wide` 4, `half` 3, `third` 2. |
| `ink` | `a` or `b`: which of the day's two inks leads the block. Alternate them. |
| `texture` | `flat` (open on the paper), `halftone` (tinted plate with a halftone corner, for features you want to lift), `overprint` (title printed in the block's ink). Use `halftone` on 2 or 3 blocks a day at most. |
| `title` | At most 120 characters. Sentence case; the poster and condensed type sets uppercase it visually. |
| `why` | Why it matters to any developer, 1 or 2 sentences. Specific, but public: never about the owner or their projects (see Public and private). This is the most-read line in every block. |
| `forYou` | Private, shown only in the owner's tune mode: what this means for their plugins, games, SaaS and workflow, and what to do about it. 1 or 2 sentences. Add it whenever there is a real angle. |
| `sources` | 1 to 5 `{ label, url }`, https only, primary source first. |
| `image` | Optional real picture (see Pictures). Hero, spotlight and concept use it in their visual slot; every other format shows it under the title. |

### Rows

The grid has 6 columns. Compose rows that fill them, in order:
`full` alone; `wide + third`; `third + wide`; `half + half`; `third + third + third`.
`npm run validate` warns when a row is ragged. On tablets `wide` and `half` go full
width and `third` goes half; on phones everything stacks.

## Formats

Choose by what the reader needs to learn, not by what is easiest to write.

| Format | Use it when | Extra fields | Good sizes |
|---|---|---|---|
| `hero` | The day's lead. Exactly one, first. | `variant` (`split` text beside art, `poster` wide art band with the title cutting into it, `stack` title over a 3:1 art band), `takeaway` (the point in two sentences), `body` 1-4 paragraphs, then one visual at most: `image` (preferred), `diagram` `{ layout, nodes (2-6), links, caption }` drawn by the kit after the headline, or a labelled `art` schematic; `stat` `{ value, label }` optional. With no visual the hero is text only. | `full` |
| `spotlight` | A product, tool, model or release to know by name. | `name` (big), `what` (one line), `body` 1-3, `facts` up to 5 `{ k, v }`, `tryIt` (a command, URL or setting), `art` optional | `half`, `wide` |
| `steps` | A process, workflow or how-to. Only real sequences. | `intro`, `steps` 2-7 `{ title, text }` | `half`, `wide`, `full` |
| `compare` | Two things side by side: before and after, A vs B. | `intro`, `left`, `right` (column names), `rows` 2-8 `{ aspect, left, right }`, `verdict` | `full`, `wide` |
| `stat` | One to three numbers that carry the story. Keep values short (under 7 characters in a `third`). | `stats` 1-3 `{ value, label }`, `body` 1-2 | `third`, `half` |
| `chart` | A series of comparable numbers. Four or more bars reads best. | `intro`, `unit`, `series` 2-10 `{ label, value, highlight }`, `note` | `half`, `wide` |
| `timeline` | Dated events where order matters. | `intro`, `events` 2-8 `{ when, text }` | `third`, `half` |
| `quote` | A short line that is the story. Under 20 words; at most two quotes an issue. | `quote`, `speaker`, `role`, `context` | `third`, `half` |
| `code` | A real snippet, command or config the reader can use. Never invented. | `intro`, `lang`, `code` (plain text, keep it under 20 lines), `explain` 1-3 | `half`, `wide` |
| `concept` | An idea to understand: a technique, a term, an architecture. | `plain` (the idea in one sentence), `body` 1-3, `points` up to 5, `art` optional | `half`, `wide` |
| `video` | An official or genuinely useful video. | `youtubeId` (11 characters), `body` 1-2 | `half`, `wide` |
| `list` | Several related small items: release notes, a roundup. | `intro`, `items` 2-6 `{ title, text, url }` | `wide`, `full` |
| `diagram` | How something works: a pipeline, an architecture, a loop, a system and its parts. Prefer it to prose and to drawn art whenever the story has structure. | `layout` (`flow` steps left to right, `layers` a stack top to bottom, `hub` one center and its parts, `cycle` a loop), `intro`, `nodes` 2-8 `{ label, note, key }` (mark the one that matters with `key`), `links` labels for the arrows in order (flow, cycle), `caption` | `half`, `wide`, `full` |
| `bespoke` | An interactive piece built for one story when interaction teaches more than prose. At most one a day. | `src`, `height` (240-900), `body` 1-2 | `full`, `wide` |

## Public and private

The page is public. Everything a visitor sees is written for any developer: `title`,
`dek`, `tldr`, `why`, `takeaway`, bodies, a spark's `hook` and `borrow`, a lab
entry's `useIt`. Never address "the reader" as one person, and never name or describe the
owner's own work there: their plugins or Fab listings, games (ElementalBlades), SaaS
(Polyglyph, Vylora, ObraJusta), Imperion Games, their Claude Code setup or this routine.
Generic second person ("if you ship on Steam") is fine.

The owner's angle goes in `forYou` on blocks, sparks and lab entries. It renders only in
tune mode, which only the owner turns on. `taste.md` has the profile to write it from.
`npm run validate` fails an issue whose public text names the owner's projects.

## Pictures

A visual must help the reader understand the story. Decoration does not: abstract
shapes, symbolic art and mood images were tried and rejected because they add nothing.
In order of preference:

1. **A real image** (`image` on the block): the thing itself. A product or editor
   screenshot, a game's official screenshot, a paper's figure, a chart from the source,
   a photo from the event, a video still.
2. **A kit diagram or chart**: the `diagram` format (or `diagram` on the hero) when the
   story is a process, a pipeline, an architecture or a loop; `chart`, `stat`,
   `compare` or `timeline` when it is numbers or dates. These read best of all.
3. **A labelled schematic** drawn as SVG (`art`), only when the mechanism does not fit the
   kit's diagram layouts. It must label its parts: validate rejects drawn art with fewer
   than three text labels.
4. **Nothing.** A block with no real image and no structure to draw has no visual, and
   that is fine. Never invent a picture to fill space.

Getting images: `node scripts/fetch-image.mjs --list <article-url>` lists the page's
share image and the images inside the article; `node scripts/fetch-image.mjs <image-or-page-url> <date> <slug>`
downloads one, re-encodes it to `public/img/<date>/<slug>.webp` and writes a preview to
`.cache/preview/<slug>.png`. **Look at every preview before using it.**

- Reject: logos and brand cards, generic stock photos, author headshots, thumbnails with
  clickbait text burned in ("X DUMPS Y"), images too small or blurry to read.
- Good sources: the article's own figures, vendor blog and press images, official game
  screenshots from Steam (`https://store.steampowered.com/api/appdetails?appids=<id>&filters=screenshots`,
  use a `path_full` URL), itch.io page screenshots, arXiv figures (`https://arxiv.org/html/<id>`
  pages link them), project pages, YouTube stills (`https://i.ytimg.com/vi/<id>/maxresdefault.jpg`).
- `image` fields: `src`, `alt` (what the picture shows, for someone who cannot see it),
  `credit` (publisher, studio or authors, plus the licence when it is a paper), `creditUrl`
  (the page it came from), `fit`.
- Images always show in their own colors. Never tint, filter or recolor them.
- `fit: "contain"` for charts and figures that must show whole; `"cover"` for photos and
  screenshots that can crop.
- Credit every image and link to where it came from. Use the image to illustrate the story
  it came from, never decoratively elsewhere.

## Sparks

`sparks` items: `{ id, lane, kind, title, where, signal, hook, borrow, url, image }`.

| Field | What it is |
|---|---|
| `kind` | `game`, `concept`, `devlog`, `technique`, `tool` or `experiment` |
| `where` | Where it is happening: Steam, itch.io, YouTube, X, TikTok, Reddit, Hacker News |
| `signal` | The evidence it is rising, with a number: "up 43 places to #9 in Steam's most played", "2.1M views in four days", "top of r/IndieDev this week". Name the source. |
| `hook` | What makes it catch, in one line: the mechanic, the twist, the presentation |
| `borrow` | What the reader could take from it for their own games, plugins or tools |
| `image` | Strongly preferred: the game's screenshot or the video still |

Three or six sparks fill the rows on wide screens; four or five leave a gap.

## The lab

`lab` items: `{ id, lane, kind, title, headline, authors, where, date, problem, idea, result, useIt, maturity, links, image }`.

| Field | What it is |
|---|---|
| `kind` | `paper`, `preprint`, `thesis`, `report` or `talk` |
| `title` | The real title, as published |
| `headline` | The finding in everyday words, the line a developer would repeat |
| `authors` | First three authors, "et al.", and the institutions in parentheses |
| `where` | Venue or "arXiv preprint", "PhD thesis, University of X", "NVIDIA Research" |
| `problem`, `idea`, `result`, `useIt` | Plain words. `result` has the numbers and what they beat. `useIt` is concrete: what to try, build or watch for. |
| `maturity` | `idea`, `prototype`, `code` (code released) or `shipping` (in a product) |
| `links` | Paper first, then code and project page |
| `image` | The paper's teaser or main figure, `natural`, `contain` |

Read the paper itself (the arXiv abstract and HTML full text, or the PDF), not a summary of it.

## Theme

Pick ids, never colors. `src/kit/catalog.mjs` has the tables and guarantees contrast:
an ink too light for type on the chosen paper automatically drops back to the text
ink for headlines and stays in art and fills.

- `inks` (two, different): `fluoro-pink`, `yellow`, `sunflower`, `orange`, `bright-red`, `coral`, `green`, `kelly`, `teal`, `aqua`, `mint`, `blue`, `cornflower`, `medium-blue`, `purple`, `violet`
- `text`: `black`, `federal-blue`, `burgundy`, `hunter`, `brown`
- `paper`: `bright-white`, `sky`, `mint`, `blush`, `fog`, `butter`, `lilac`
- `type`: `poster` (tall condensed caps), `wide` (expanded grotesque), `grotesk` (Bricolage), `condensed` (narrow caps)
- `mood`: optional, a few words for the colophon.

Rules: never repeat yesterday's ink pair; change at least two of paper, text, type
from yesterday; pair one darker ink (`medium-blue`, `blue`, `teal`, `purple`, `green`,
`bright-red`) with one bright ink so headlines keep a color; let the day's tone
suggest the mood (a heavy news day can be loud, a quiet one softer).

## Labelled schematics (art)

Only for a mechanism the kit's diagram layouts cannot show: a memory layout, a render
pass, a network topology, a game loop with timing. It is a technical drawing with its
parts labelled, never a symbolic or decorative picture.

- File: `public/art/<date>/<slug>.svg`, referenced as `art/<date>/<slug>.svg`.
- One `<svg>` with a `viewBox`. 4:3 for heroes (`split`), 21:8 for `poster`, 3:1 for
  `stack`, 16:9 for other blocks. It is shown with `object-fit: cover`.
- Use only the day's two ink hex values, the text ink and the paper hex (from the
  catalog), with `style="mix-blend-mode:multiply"` on overlapping shapes for the
  riso overprint look. Halftone fills via `<pattern>` work well.
- Label the parts with `<text>` (three labels at least; validate checks). Use a generic
  font stack such as `font-family="Georgia, serif"` with a size of 14 or more: web fonts
  are not loaded inside SVG files.
- Not allowed (validate rejects them): scripts, event handlers, `foreignObject`,
  external `href`s, `url()` to anything but `#ids`, embedded media. Under 80 KB.
- Always set `artAlt` describing what the picture shows.

## Bespoke pieces

A self-contained HTML page shown in a sandboxed frame (`sandbox="allow-scripts"`,
no same-origin), so it cannot touch the site, cookies or storage.

- File: `public/bespoke/<date>/<slug>.html`, referenced as `bespoke/<date>/<slug>.html`.
- The first thing in `<head>` must be exactly:
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:">`
- Inline CSS and JS only. No network, no storage, no external fonts or images,
  no reaching into `parent` or `top`. Under 200 KB.
- Paint the day's paper color as its background and use the day's inks.
- Works with mouse, touch and keyboard, and the block's `body` must still tell the
  story if the frame never loads.
