# Design notebook

The morning run's memory for craft, kept short on purpose (60 lines at most; drop
the oldest lines first). One or two lines per issue: what was tried, what worked,
what to avoid next time. Facts about stories never go here.

- 2026-10-14 No. 1: medium-blue + fluoro-pink on bright-white, poster type, split hero with generated art. Fourteen blocks felt full; twelve is probably the sweet spot. Stat blocks in a third column need short values (under 6 characters). A wide chart with only two bars reads thin; give charts four or more bars or use a stat instead.
- 2026-10-15 No. 2: teal + coral on fog, federal-blue text, wide type, stack hero with drawn art. Wide type makes big titles very tall: keep hero titles to about 30 characters and avoid long single words (phones clip them). A cycle diagram with 6 nodes collides with its labels; use flow for 5+ nodes. Three stats in a half block overflow in wide type; two is the limit. Before quoting a source, check the last issues: yesterday's quote source came back today and validate caught it.

## Kit requests

- Code blocks: the global `code` rule (tint background) also applies inside `.codebox pre code`, so code renders as paper-colored text on a light tint, nearly unreadable. Reset `background` and `padding` for `.codebox code`. Today's code story ran as a spotlight instead.
- Poster hero in dark mode: the art plate stays the light paper color while the title turns light, so where the title cuts into the art it is light on light. Give the plate the night paper, or keep the title off the plate in dark mode.
