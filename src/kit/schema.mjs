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
const imagePath = z.string().regex(/^img\/\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\.webp$/, 'img/<date>/<slug>.webp (made by scripts/fetch-image.mjs)');

/**
 * A real picture: a publisher's or vendor's own image, a paper figure, a video
 * still or a screenshot, downloaded and re-encoded by scripts/fetch-image.mjs.
 * Always credited, and always shown in its own colors.
 */
export const Image = z.object({
  src: imagePath,
  alt: text(240),
  credit: text(80),
  creditUrl: url,
  fit: z.enum(['cover', 'contain']).default('cover'),
});

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
  /** Why this matters to any developer, in one or two sentences. Public: never about the owner's own work. */
  why: text(320),
  /**
   * The owner's private angle: what this means for their plugins, games, SaaS and
   * workflow, and what to do about it. Shown only in tune mode.
   */
  forYou: text(400).optional(),
  sources: z.array(Source).min(1).max(5),
  /** Optional real picture for the block; hero, spotlight and concept use it in place of art. */
  image: Image.optional(),
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

/** A clean schematic of how something works, drawn by the kit. */
export const Diagram = z.object({
  ...base,
  format: z.literal('diagram'),
  /** flow: steps left to right; layers: a stack, top to bottom; hub: one center and its parts; cycle: a loop. */
  layout: z.enum(['flow', 'layers', 'hub', 'cycle']),
  intro: text(400),
  nodes: z.array(z.object({ label: text(40), note: text(120).optional(), key: z.boolean().default(false) })).min(2).max(8),
  /** Labels on the connections, in order (flow and cycle only). */
  links: z.array(text(40)).max(8).default([]),
  caption: text(300).optional(),
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
  Hero, Spotlight, Steps, Compare, Stat, Chart, Timeline, Quote, Code, Concept, Video, List, Diagram, Bespoke,
]);

/**
 * Sparks: what is rising (games, concepts, devlogs, techniques, experiments)
 * and the idea worth borrowing from it. For creativity and trend awareness.
 */
export const Spark = z.object({
  id: slug,
  lane: Lane,
  kind: z.enum(['game', 'concept', 'devlog', 'technique', 'tool', 'experiment']),
  title: text(80),
  /** Where it is happening: Steam, itch.io, YouTube, X, Reddit, TikTok, Hacker News... */
  where: text(40),
  /** The evidence it is rising, with a number when there is one. */
  signal: text(200),
  /** The idea in one line: what makes it catch. */
  hook: text(240),
  /** What the reader could take from it for their own work. */
  borrow: text(260),
  /** Private angle for the owner, shown only in tune mode. */
  forYou: text(400).optional(),
  url,
  image: Image.optional(),
});

/** A research result for The lab: papers, theses, preprints, lab reports. */
export const Paper = z.object({
  id: slug,
  lane: Lane,
  kind: z.enum(['paper', 'preprint', 'thesis', 'report', 'talk']),
  title: text(200),
  /** The finding in everyday words, shown big. */
  headline: text(140),
  authors: text(160),
  where: text(120),
  date,
  problem: text(400),
  idea: text(600),
  result: text(400),
  useIt: text(400),
  maturity: z.enum(['idea', 'prototype', 'code', 'shipping']),
  /** Private angle for the owner, shown only in tune mode. */
  forYou: text(400).optional(),
  links: z.array(Source).min(1).max(4),
  image: Image.optional(),
});

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
    /** The lab: 1 to 3 research results worth knowing. */
    lab: z.array(Paper).max(3).default([]),
    /** Sparks: 3 to 6 rising games, concepts and techniques. */
    sparks: z.array(Spark).max(6).default([]),
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
      for (const key of ['art', 'src', 'image']) {
        const v = /** @type {any} */ (b)[key];
        const p = typeof v === 'object' && v ? v.src : v;
        if (p && !p.includes(`/${issue.date}/`)) {
          ctx.addIssue({ code: 'custom', message: `${key} must live under the issue's own date folder`, path: ['blocks', i, key] });
        }
      }
    });
    issue.sparks.forEach((spark, i) => {
      if (spark.image && !spark.image.src.includes(`/${issue.date}/`)) {
        ctx.addIssue({ code: 'custom', message: "image must live under the issue's own date folder", path: ['sparks', i, 'image'] });
      }
      if (seen.has(spark.id)) ctx.addIssue({ code: 'custom', message: `duplicate id ${spark.id}`, path: ['sparks', i, 'id'] });
      seen.add(spark.id);
    });
    issue.lab.forEach((paper, i) => {
      if (paper.image && !paper.image.src.includes(`/${issue.date}/`)) {
        ctx.addIssue({ code: 'custom', message: "image must live under the issue's own date folder", path: ['lab', i, 'image'] });
      }
      if (seen.has(paper.id)) ctx.addIssue({ code: 'custom', message: `duplicate id ${paper.id}`, path: ['lab', i, 'id'] });
      seen.add(paper.id);
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
  /** Sunday's longer read: one research result explained in more depth. */
  deepRead: Paper.extend({ more: z.array(text(700)).min(1).max(4) }).optional(),
});
