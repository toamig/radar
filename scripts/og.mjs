#!/usr/bin/env node
// Share cards: one 1200x630 JPEG per kept issue and week, in that day's
// accent colors, for link previews (WhatsApp, Slack, X, LinkedIn...).
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
  { name: 'Geist', data: font('geist', 'geist-latin-400-normal.woff'), weight: 400, style: 'normal' },
  { name: 'Geist', data: font('geist', 'geist-latin-600-normal.woff'), weight: 600, style: 'normal' },
  { name: 'Geist', data: font('geist', 'geist-latin-700-normal.woff'), weight: 700, style: 'normal' },
];
// One family now: every type set prints in Geist Bold.
const DISPLAY = { family: 'Geist', upper: false, size: 1, tracking: -2 };

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
  const c = t.night;
  const d = DISPLAY;
  const textW = image ? W - 520 : W;
  // Shorter headlines print bigger; long ones step down so they fit in four lines.
  const len = title.length;
  const base = len <= 28 ? 78 : len <= 44 ? 68 : len <= 60 ? 58 : 50;
  const size = Math.round(base * (image ? 0.92 : 1));
  const rule = `1px solid ${c.muted}55`;
  return h('div', {
    width: W, height: H, color: c.text, fontFamily: 'Geist', backgroundColor: c.paper,
    backgroundImage: `radial-gradient(circle at 8% -10%, ${c.inkA}55, ${c.inkA}00 55%), radial-gradient(circle at 96% 0%, ${c.inkB}44, ${c.inkB}00 50%)`,
  },
    h('div', { width: textW, height: H, flexDirection: 'column', padding: '44px 56px 40px 56px' },
      h('div', { justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20, borderBottom: rule },
        h('div', { alignItems: 'center', gap: 14 },
          { type: 'img', props: { src: toaMark(c.inkB, c.displayA), style: { width: 70, height: 40 } } },
          h('div', { fontFamily: 'Geist', fontWeight: 700, fontSize: 52, lineHeight: 1, letterSpacing: -2, color: c.text }, 'Radar')),
        h('div', { alignItems: 'center', gap: 14, fontSize: 22, color: c.muted },
          h('div', { fontWeight: 600, color: c.displayA, border: `1px solid ${c.displayA}`, borderRadius: 99, padding: '4px 14px' }, number),
          h('div', {}, date))),
      h('div', { flexDirection: 'column', paddingTop: image ? 44 : 38 },
        h('div', { fontFamily: 'Geist', fontWeight: 700, fontSize: size, lineHeight: 1.04, letterSpacing: d.tracking, color: c.text }, title),
        image && line ? h('div', { marginTop: 24, fontSize: 26, lineHeight: 1.4, color: c.muted, maxHeight: 110, overflow: 'hidden' }, line) : null,
        !image && points.length ? h('div', { flexDirection: 'column', marginTop: 28, gap: 12 },
          points.slice(0, 2).map((pt, i) => h('div', { alignItems: 'flex-start', gap: 14, fontSize: 24, lineHeight: 1.3, color: c.muted },
            h('div', { width: 10, height: 10, marginTop: 10, flexShrink: 0, borderRadius: 99, backgroundColor: i % 2 ? c.displayB : c.displayA }),
            h('div', { maxWidth: 1000 }, pt)))) : null),
      h('div', { position: 'absolute', left: 56, right: image ? 576 : 56, bottom: 36, alignItems: 'center', gap: 16, fontSize: 21, color: c.muted },
        h('div', { fontWeight: 600, color: c.text, whiteSpace: 'nowrap' }, 'by Toamig'),
        image ? null : h('div', { whiteSpace: 'nowrap' }, 'a daily briefing on game dev, software and AI'),
        h('div', { marginLeft: image ? 0 : 'auto', fontWeight: 600, color: c.displayA, whiteSpace: 'nowrap' }, 'toamig.com/radar'))),
    image ? h('div', { width: 520, height: H, borderLeft: rule }, { type: 'img', props: { src: image, width: 512, height: H, style: { objectFit: 'cover' } } }) : null);
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
