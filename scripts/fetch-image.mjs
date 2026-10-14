#!/usr/bin/env node
// Brings a real picture into an issue: give it an article URL (it takes the
// page's own share image, og:image or twitter:image) or a direct image URL
// (an image inside the article, a paper figure, a press image, a video still).
// The image is re-encoded to WebP with sharp, which also strips metadata and
// anything that is not pixels, and saved as public/img/<date>/<slug>.webp.
//
//   node scripts/fetch-image.mjs <url> <date> <slug>
//   node scripts/fetch-image.mjs --list <article-url>
//
// --list prints the page's share image and the images inside the article, so you
// can pick the one that shows the thing (share images are often just a logo).
// Every saved image also gets a PNG preview in .cache/preview/<slug>.png: look at
// it before using the image.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const UA = 'Mozilla/5.0 (compatible; RadarBot/1.0; +https://toamig.com/radar/)';
const MAX_BYTES = 15 * 1024 * 1024;
const IMAGE_ACCEPT = 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5';

async function get(u, accept) {
  const res = await fetch(u, { headers: { 'User-Agent': UA, Accept: accept }, redirect: 'follow', signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${u}`);
  return res;
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];

function shareImage(html, base) {
  const metas = [...html.matchAll(/<meta\s+[^>]*>/gi)].map((m) => m[0]);
  for (const key of ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) {
    const tag = metas.find((t) => (attr(t, 'property') ?? attr(t, 'name'))?.toLowerCase() === key);
    const content = tag && attr(tag, 'content');
    if (content) return new URL(content.replace(/&amp;/g, '&'), base).href;
  }
  return null;
}

async function listImages(page) {
  const res = await get(page, 'text/html');
  const html = await res.text();
  const base = res.url;
  const article = html.match(/<(article|main)\b[\s\S]*?<\/(article|main)>/i);
  const body = article ? article[0] : html;
  const seen = new Set();
  const images = [];
  for (const m of body.matchAll(/<img\s[^>]*>/gi)) {
    const tag = m[0];
    let src = attr(tag, 'src') ?? attr(tag, 'data-src');
    const srcset = attr(tag, 'srcset') ?? attr(tag, 'data-srcset');
    if (srcset) src = srcset.split(',').map((x) => x.trim().split(/\s+/)[0]).pop();
    if (!src || src.startsWith('data:') || /\.svg(\?|$)|sprite|icon|logo|avatar|pixel|badge|emoji|gravatar/i.test(src)) continue;
    const abs = new URL(src.replace(/&amp;/g, '&'), base).href;
    if (seen.has(abs)) continue;
    seen.add(abs);
    images.push({ src: abs, alt: (attr(tag, 'alt') ?? '').slice(0, 120), width: attr(tag, 'width') ?? '' });
    if (images.length >= 15) break;
  }
  console.log(JSON.stringify({ page: base, share: shareImage(html, base), images }, null, 2));
}

const listMode = process.argv[2] === '--list';
const [url, date, slug] = process.argv.slice(listMode ? 3 : 2);
if (listMode && url) {
  await listImages(url);
  process.exit(0);
}
if (!url || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug ?? '')) {
  console.error('usage: node scripts/fetch-image.mjs <url> <YYYY-MM-DD> <slug>\n       node scripts/fetch-image.mjs --list <article-url>');
  process.exit(2);
}

let imageUrl = url;
let res = await get(url, `${IMAGE_ACCEPT},text/html;q=0.9`);
let type = res.headers.get('content-type') ?? '';
if (type.includes('text/html')) {
  const found = shareImage(await res.text(), res.url);
  if (!found) {
    console.error(`No og:image or twitter:image on ${url}; try --list and pick an image from the article.`);
    process.exit(1);
  }
  imageUrl = found;
  res = await get(imageUrl, IMAGE_ACCEPT);
  type = res.headers.get('content-type') ?? '';
}
if (!type.startsWith('image/') || type.includes('svg')) {
  console.error(`Not a raster image (${type}) at ${imageUrl}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
if (buf.length > MAX_BYTES) {
  console.error(`Image is ${buf.length} bytes; the limit is ${MAX_BYTES}`);
  process.exit(1);
}

const meta = await sharp(buf, { limitInputPixels: 60_000_000 }).metadata();
if ((meta.width ?? 0) < 400) {
  console.error(`Image is only ${meta.width}px wide; probably a logo or icon. Find a better one.`);
  process.exit(1);
}

let out;
for (const [width, quality] of [[1600, 80], [1400, 70], [1200, 62]]) {
  out = await sharp(buf, { limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  if (out.data.length <= 400_000) break;
}

const dir = join(root, 'public', 'img', date);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${slug}.webp`), out.data);
const previewDir = join(root, '.cache', 'preview');
mkdirSync(previewDir, { recursive: true });
await sharp(out.data).resize({ width: 900, withoutEnlargement: true }).png().toFile(join(previewDir, `${slug}.png`));
console.log(JSON.stringify({
  src: `img/${date}/${slug}.webp`,
  width: out.info.width,
  height: out.info.height,
  bytes: out.data.length,
  from: imageUrl,
  preview: `.cache/preview/${slug}.png`,
}, null, 2));
