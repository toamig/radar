// The shape of an issue and a weekly summary. The daily routine writes JSON
// that must parse against these schemas; the build refuses anything else.
// Text fields are plain text with a tiny inline markup (**bold**, `code`,
// [label](https://url)), rendered escaped by src/kit/inline.ts.
import { z } from 'zod';
import { INKS, PAPERS, TEXT_INKS, TYPE_SETS } from './catalog.mjs';

const ids = (table) => z.enum(/** @type {[string, ...string[]]} */ (Object.keys(table)));
const text = (max) => z.string().trim().min(1).max(max);
const url = z.string().url().refine((u) => /^https:\/\//.test(u), 'links must be https');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/, 'lowercase slug');

// Local art and bespoke pieces live under public/, keyed by issue date.
const artPath = z.string().regex(/^art\/\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\.svg$/, 'art/<date>/<slug>.svg');
const bespokePath = z.string().regex(/^bespoke\/\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\.html$/, 'bespoke/<date>/<slug>.html');

export const Theme = z.object({
  paper: ids(PAPERS),
  text: ids(TEXT_INKS),
  inks: z.tuple([ids(INKS), ids(INKS)]).refine(([a, b]) => a !== b, 'two different inks'),
  type: ids(TYPE_SETS),
  mood: text(80).optional(),
});

export const Source = z.object({ label: text(80), url });

export const Lane = z.enum(['gamedev', 'ai', 'both']);

const base = {
  id: slug,
  lane: Lane,
  /** 1 = headline, 2 = feature, 3 = standard, 4 = minor. */
  importance: z.number().int().min(1).max(4),
  size: z.enum(['full', 'wide', 'half', 'third']),
  /** Which of the day's two inks leads this block. */
  ink: z.enum(['a', 'b']).default('a'),
  texture: z.enum(['flat', 'halftone', 'overprint']).default('flat'),
  title: text(120),
  /** Why this matters to the reader, in one or two sentences. */
  why: text(320),
  sources: z.array(Source).min(1).max(5),
};

const Para = text(700);
const Fact = z.object({ k: text(40), v: text(140) });

export const Hero = z.object({
  ...base,
  format: z.literal('hero'),
  variant: z.enum(['split', 'poster', 'stack']).default('split'),
  takeaway: text(240),
  body: z.array(Para).min(1).max(4),
  art: artPath.optional(),
  artAlt: text(200).optional(),
  stat: z.object({ value: text(16), label: text(80) }).optional(),
});

export const Spotlight = z.object({
  ...base,
  format: z.literal('spotlight'),
  name: text(60),
  what: text(160),
  body: z.array(Para).min(1).max(3),
  facts: z.array(Fact).max(5).default([]),
  tryIt: text(200).optional(),
  art: artPath.optional(),
  artAlt: text(200).optional(),
});

export const Steps = z.object({
  ...base,
  format: z.literal('steps'),
  intro: text(400),
  steps: z.array(z.object({ title: text(70), text: text(320) })).min(2).max(7),
});

export const Compare = z.object({
  ...base,
  format: z.literal('compare'),
  intro: text(400),
  left: text(40),
  right: text(40),
  rows: z.array(z.object({ aspect: text(50), left: text(160), right: text(160) })).min(2).max(8),
  verdict: text(300).optional(),
});

export const Stat = z.object({
  ...base,
  format: z.literal('stat'),
  stats: z.array(z.object({ value: text(14), label: text(90) })).min(1).max(3),
  body: z.array(Para).min(1).max(2),
});

export const Chart = z.object({
  ...base,
  format: z.literal('chart'),
  intro: text(400),
  unit: text(24),
  series: z.array(z.object({ label: text(40), value: z.number(), highlight: z.boolean().default(false) })).min(2).max(10),
  note: text(400).optional(),
});

export const Timeline = z.object({
  ...base,
  format: z.literal('timeline'),
  intro: text(400),
  events: z.array(z.object({ when: text(24), text: text(240) })).min(2).max(8),
});

export const Quote = z.object({
  ...base,
  format: z.literal('quote'),
  /** Keep quotes short: a line, not a passage. */
  quote: z.string().trim().min(1).max(200).refine((q) => q.split(/\s+/).length <= 30, 'quotes stay under 30 words'),
  speaker: text(60),
  role: text(100).optional(),
  context: text(500),
});

export const Code = z.object({
  ...base,
  format: z.literal('code'),
  intro: text(400),
  lang: text(20),
  code: z.string().min(1).max(1600),
  explain: z.array(Para).min(1).max(3),
});

export const Concept = z.object({
  ...base,
  format: z.literal('concept'),
  /** The idea in one plain sentence. */
  plain: text(220),
  body: z.array(Para).min(1).max(3),
  points: z.array(text(160)).max(5).default([]),
  art: artPath.optional(),
  artAlt: text(200).optional(),
});

export const Video = z.object({
  ...base,
  format: z.literal('video'),
  youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  body: z.array(Para).min(1).max(2),
});

export const List = z.object({
  ...base,
  format: z.literal('list'),
  intro: text(300).optional(),
  items: z.array(z.object({ title: text(90), text: text(300), url: url.optional() })).min(2).max(6),
});

export const Bespoke = z.object({
  ...base,
  format: z.literal('bespoke'),
  src: bespokePath,
  height: z.number().int().min(240).max(900),
  /** Shown above the piece, and alone when the frame cannot load. */
  body: z.array(Para).min(1).max(2),
});

export const Block = z.discriminatedUnion('format', [
  Hero, Spotlight, Steps, Compare, Stat, Chart, Timeline, Quote, Code, Concept, Video, List, Bespoke,
]);

export const TickerItem = z.object({
  text: text(200),
  lane: Lane,
  url,
  source: text(40),
});

export const Issue = z
  .object({
    date,
    number: z.number().int().min(1),
    /** The day's headline phrase, used in the masthead and the week strip. */
    title: text(90),
    dek: text(260),
    theme: Theme,
    tldr: z.array(z.object({ text: text(220), lane: Lane })).min(3).max(5),
    blocks: z.array(Block).min(4).max(14),
    ticker: z.array(TickerItem).max(14).default([]),
    /** One line on how today was put together, shown in the colophon. */
    note: text(300).optional(),
  })
  .superRefine((issue, ctx) => {
    if (issue.blocks[0]?.format !== 'hero') {
      ctx.addIssue({ code: 'custom', message: 'the first block must be the hero', path: ['blocks', 0] });
    }
    const seen = new Set();
    issue.blocks.forEach((b, i) => {
      if (seen.has(b.id)) ctx.addIssue({ code: 'custom', message: `duplicate block id ${b.id}`, path: ['blocks', i, 'id'] });
      seen.add(b.id);
      for (const key of ['art', 'src']) {
        const p = /** @type {any} */ (b)[key];
        if (p && !p.includes(`/${issue.date}/`)) {
          ctx.addIssue({ code: 'custom', message: `${key} must live under the issue's own date folder`, path: ['blocks', i, key] });
        }
      }
    });
  });

export const Week = z.object({
  id: z.string().regex(/^\d{4}-W\d{2}$/),
  from: date,
  to: date,
  title: text(90),
  dek: text(300),
  theme: Theme,
  tldr: z.array(text(240)).min(3).max(6),
  threads: z
    .array(
      z.object({
        title: text(100),
        lane: Lane,
        summary: z.array(Para).min(1).max(3),
        days: z.array(date).min(1).max(7),
        sources: z.array(Source).min(1).max(5),
      }),
    )
    .min(2)
    .max(7),
  numbers: z.array(z.object({ value: text(14), label: text(90), date })).max(6).default([]),
  watch: z.array(text(220)).max(5).default([]),
});
