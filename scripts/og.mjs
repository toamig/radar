#!/usr/bin/env node
// Share cards: one 1200x630 JPEG per kept issue and week, printed in that day's
// inks and headline face, for link previews (WhatsApp, Slack, X, LinkedIn...).
// Runs before every build; output goes to public/og/ (not committed).
import { readFileSync, readdirSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { resolveTheme } from '../src/kit/catalog.mjs';
import { toaSvg } from '../src/kit/toa-mark.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const W = 1200, H = 630;
const KEEP_DAYS = 7, KEEP_WEEKS = 4;

const font = (pkg, file) => readFileSync(join(root, 'node_modules', '@fontsource', pkg, 'files', file));
const fonts = [
  { name: 'Big Shoulders', data: font('big-shoulders-display', 'big-shoulders-display-latin-800-normal.woff'), weight: 800, style: 'normal' },
  { name: 'Anybody', data: font('anybody', 'anybody-latin-800-normal.woff'), weight: 800, style: 'normal' },
  { name: 'Bricolage', data: font('bricolage-grotesque', 'bricolage-grotesque-latin-700-normal.woff'), weight: 700, style: 'normal' },
  { name: 'Literata', data: font('literata', 'literata-latin-400-normal.woff'), weight: 400, style: 'normal' },
  { name: 'Literata', data: font('literata', 'literata-latin-600-normal.woff'), weight: 600, style: 'normal' },
];
// The static cuts closest to each type set's display face.
const DISPLAY = {
  poster: { family: 'Big Shoulders', upper: true, size: 1.25, tracking: 0 },
  condensed: { family: 'Big Shoulders', upper: true, size: 1.25, tracking: 0 },
  wide: { family: 'Anybody', upper: false, size: 0.9, tracking: -1 },
  grotesk: { family: 'Bricolage', upper: false, size: 1, tracking: -2 },
};

const toaMark = (t, oa) => `data:image/svg+xml;base64,${Buffer.from(toaSvg(t, oa)).toString('base64')}`;

const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.flat().filter((c) => c !== null && c !== false && c !== undefined) } });
const plain = (s) => String(s).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const formatDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

async function imageData(rel) {
  const p = join(root, 'public', rel);
  if (!existsSync(p)) return null;
  const jpg = await sharp(p).resize(520, H, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${jpg.toString('base64')}`;
}

function card({ theme, number, date, title, line, points = [], image }) {
  const t = resolveTheme(theme);
  const c = t.day;
  const d = DISPLAY[t.ids.type] ?? DISPLAY.grotesk;
  const textW = image ? W - 520 : W;
  // Shorter headlines print bigger; long ones step down so they fit in four lines.
  const len = title.length;
  const base = len <= 28 ? 84 : len <= 44 ? 72 : len <= 60 ? 62 : 54;
  const size = Math.round(base * d.size * (image ? 0.92 : 1));
  const word = (color, dx, dy) => h('div', { position: 'absolute', left: dx, top: dy, fontFamily: d.family, fontSize: 64, lineHeight: 1, color, textTransform: d.upper ? 'uppercase' : 'none', letterSpacing: d.tracking }, 'Radar');
  return h('div', { width: W, height: H, backgroundColor: c.paper, color: c.text, fontFamily: 'Literata' },
    h('div', { width: textW, height: H, flexDirection: 'column', padding: '44px 56px 40px 56px' },
      h('div', { justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 18, borderBottom: `6px solid ${c.text}` },
        h('div', { alignItems: 'flex-end', gap: 12 },
          { type: 'img', props: { src: toaMark(c.inkB, c.displayA), style: { width: 84, height: 48, marginBottom: 6 } } },
          h('div', { position: 'relative', width: 230, height: 64 }, word(c.inkB, 5, 4), word(c.displayA, 0, 0))),
        h('div', { flexDirection: 'column', alignItems: 'flex-end', fontSize: 22, lineHeight: 1.25 },
          h('div', { fontWeight: 600 }, number),
          h('div', { color: c.muted }, date))),
      h('div', { flexDirection: 'column', paddingTop: image ? 44 : 34 },
        h('div', { fontFamily: d.family, fontSize: size, lineHeight: 1.02, letterSpacing: d.tracking, textTransform: d.upper ? 'uppercase' : 'none', color: c.text }, title),
        image && line ? h('div', { marginTop: 22, fontSize: 27, lineHeight: 1.35, color: c.text, maxHeight: 110, overflow: 'hidden' }, line) : null,
        !image && points.length ? h('div', { flexDirection: 'column', marginTop: 26, gap: 10 },
          points.slice(0, 3).map((pt, i) => h('div', { alignItems: 'flex-start', gap: 14, fontSize: 24, lineHeight: 1.3, color: c.text },
            h('div', { width: 14, height: 14, marginTop: 9, flexShrink: 0, backgroundColor: i % 2 ? c.inkB : c.inkA }),
            h('div', { maxWidth: 1000 }, pt)))) : null),
      h('div', { position: 'absolute', left: 56, right: image ? 576 : 56, bottom: 36, alignItems: 'center', gap: 16, fontSize: 21, color: c.muted },
        h('div', { fontWeight: 600, color: c.text, whiteSpace: 'nowrap' }, 'by Toamig'),
        image ? null : h('div', { whiteSpace: 'nowrap' }, 'a daily briefing on game dev, software and AI'),
        h('div', { marginLeft: image ? 0 : 'auto', fontWeight: 600, color: c.text, whiteSpace: 'nowrap' }, 'toamig.com/radar'))),
    image ? h('div', { width: 520, height: H, borderLeft: `8px solid ${c.inkA}` }, { type: 'img', props: { src: image, width: 512, height: H, style: { objectFit: 'cover' } } }) : null);
}

async function render(node, out) {
  const svg = await satori(node, { width: W, height: H, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  // JPEG keeps cards well under the ~300 KB that some chat apps skip previews above.
  writeFileSync(out, await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toBuffer());
}

const outDir = join(root, 'public', 'og');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const list = (dir, re) => (existsSync(dir) ? readdirSync(dir).filter((f) => re.test(f)).sort().reverse() : []);
let made = 0;
for (const f of list(join(root, 'data', 'issues'), /^\d{4}-\d{2}-\d{2}\.json$/).slice(0, KEEP_DAYS)) {
  const issue = JSON.parse(readFileSync(join(root, 'data', 'issues', f), 'utf8'));
  const hero = issue.blocks?.[0];
  await render(card({
    theme: issue.theme,
    number: `No. ${issue.number}`,
    date: formatDate(issue.date),
    title: plain(issue.title),
    line: issue.tldr?.[0] ? plain(issue.tldr[0].text) : plain(issue.dek),
    points: (issue.tldr ?? []).map((x) => plain(x.text)),
    image: hero?.image ? await imageData(hero.image.src) : null,
  }), join(outDir, `${issue.date}.jpg`));
  made++;
}
for (const f of list(join(root, 'data', 'weeks'), /^\d{4}-W\d{2}\.json$/).slice(0, KEEP_WEEKS)) {
  const week = JSON.parse(readFileSync(join(root, 'data', 'weeks', f), 'utf8'));
  await render(card({
    theme: week.theme,
    number: `Week ${week.id.split('-W')[1]}`,
    date: `${formatDate(week.from)} to ${formatDate(week.to)}`.replace(/(\w+day) /g, ''),
    title: plain(week.title),
    line: plain(week.dek),
    image: null,
  }), join(outDir, `week-${week.id}.jpg`));
  made++;
}
console.log(`Share cards: ${made} written to public/og/`);
