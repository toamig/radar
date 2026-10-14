#!/usr/bin/env node
// The free first pass: read every source in config/sources.json, keep what was
// published inside the window, drop anything already featured this week, give
// each item a rough score, and write inbox/<date>.json for triage and the
// morning run. No model is involved; this step only casts the net.
//
//   node scripts/sweep.mjs [--date YYYY-MM-DD] [--hours 48]
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const config = JSON.parse(readFileSync(join(root, 'config', 'sources.json'), 'utf8'));
const date = arg('date', new Date().toISOString().slice(0, 10));
const hours = Number(arg('hours', config.windowHours ?? 48));
const since = Date.now() - hours * 3600_000;
const UA = 'RadarSweep/1.0 (+https://toamig.com/radar/; daily digest feed reader)';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', processEntities: true, htmlEntities: true });

async function get(url, accept = 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*') {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, signal: AbortSignal.timeout(20_000), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const text = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return text(v[0]);
  return text(v['#text'] ?? v['@href'] ?? '');
};
const strip = (html) =>
  text(html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const linkOf = (l) => {
  if (!l) return '';
  if (Array.isArray(l)) return linkOf(l.find((x) => !x['@rel'] || x['@rel'] === 'alternate') ?? l[0]);
  if (typeof l === 'string') return l;
  return l['@href'] ?? l['#text'] ?? '';
};
const normalize = (u) => {
  try {
    const url = new URL(u);
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|ref$|source$|fbclid|gclid)/.test(k)) url.searchParams.delete(k);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch { return u; }
};

function parseFeed(xml) {
  const doc = parser.parse(xml);
  const rssItems = doc?.rss?.channel?.item ?? doc?.['rdf:RDF']?.item;
  if (rssItems) {
    return [].concat(rssItems).map((it) => ({
      title: strip(it.title),
      url: linkOf(it.link) || text(it.guid),
      published: text(it.pubDate ?? it['dc:date'] ?? it.published),
      summary: strip(it.description ?? it['content:encoded'] ?? ''),
    }));
  }
  const entries = doc?.feed?.entry;
  if (entries) {
    return [].concat(entries).map((it) => ({
      title: strip(it.title),
      url: linkOf(it.link),
      published: text(it.published ?? it.updated),
      summary: strip(it.summary ?? it.content ?? ''),
    }));
  }
  throw new Error('not an RSS or Atom feed');
}

async function readSource(src) {
  if (src.kind === 'rss') return parseFeed(await get(src.url));
  if (src.kind === 'github') return parseFeed(await get(`https://github.com/${src.repo}/releases.atom`));
  if (src.kind === 'hn') {
    const after = Math.floor(since / 1000);
    const url = `https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=100&numericFilters=created_at_i>${after},points>${src.minPoints ?? 100}`;
    const data = JSON.parse(await get(url, 'application/json'));
    return data.hits.map((h) => ({
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
      published: h.created_at,
      summary: strip(h.story_text ?? ''),
      points: h.points,
      comments: h.num_comments,
    }));
  }
  throw new Error(`unknown kind ${src.kind}`);
}

// URLs already featured in the kept issues, so the same story is not offered again.
const featured = new Set();
const issueDir = join(root, 'data', 'issues');
if (existsSync(issueDir)) {
  for (const f of readdirSync(issueDir).filter((f) => f.endsWith('.json'))) {
    try {
      const issue = JSON.parse(readFileSync(join(issueDir, f), 'utf8'));
      for (const b of issue.blocks ?? []) for (const s of b.sources ?? []) featured.add(normalize(s.url));
      for (const t of issue.ticker ?? []) featured.add(normalize(t.url));
    } catch {}
  }
}

const results = [];
const report = [];
// Reddit rate-limits parallel readers, so its feeds go one at a time with a pause.
const isReddit = (src) => /reddit.com/.test(src.url ?? '');
const queue = config.sources.filter((s) => !isReddit(s));
const slow = config.sources.filter(isReddit);
async function worker(list = queue, pause = 0) {
  while (list.length) {
    const src = list.shift();
    if (pause) await new Promise((r) => setTimeout(r, pause));
    const t0 = Date.now();
    try {
      const items = await readSource(src);
      let kept = 0;
      for (const it of items) {
        const ts = Date.parse(it.published);
        if (!it.title || !it.url || Number.isNaN(ts) || ts < since) continue;
        const url = normalize(it.url);
        if (featured.has(url)) continue;
        kept++;
        results.push({
          title: clip(it.title, 200),
          url,
          source: src.name,
          lane: src.lane,
          published: new Date(ts).toISOString(),
          summary: clip(it.summary ?? '', 480),
          ...(it.points != null && { points: it.points, comments: it.comments, discussion: it.discussion }),
          weight: src.weight ?? 1,
        });
      }
      report.push({ source: src.name, ok: true, items: items.length, kept, ms: Date.now() - t0 });
    } catch (e) {
      report.push({ source: src.name, ok: false, error: String(e.message ?? e).slice(0, 120) });
    }
  }
}
await Promise.all([...Array.from({ length: 8 }, () => worker()), worker(slow, 2500)]);

// Merge duplicates (same URL from two feeds) and score.
const byUrl = new Map();
for (const it of results) {
  const prev = byUrl.get(it.url);
  if (prev) {
    prev.alsoIn = [...new Set([...(prev.alsoIn ?? []), it.source])];
    prev.weight = Math.max(prev.weight, it.weight) + 0.5;
    if (it.points != null) Object.assign(prev, { points: it.points, comments: it.comments, discussion: it.discussion });
  } else byUrl.set(it.url, { ...it });
}
const now = Date.now();
const items = [...byUrl.values()]
  .map((it) => {
    const ageH = (now - Date.parse(it.published)) / 3600_000;
    const fresh = Math.max(0.3, 1 - ageH / (hours * 1.2));
    const buzz = it.points ? Math.log10(it.points + 1) + Math.log10((it.comments ?? 0) + 1) * 0.5 : 0;
    return { ...it, score: Math.round((it.weight * 2 + buzz) * fresh * 100) / 100 };
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, 400)
  .map((it, i) => ({ id: `c${String(i + 1).padStart(3, '0')}`, ...it }));

mkdirSync(join(root, 'inbox'), { recursive: true });
const out = join(root, 'inbox', `${date}.json`);
writeFileSync(out, JSON.stringify({ date, generatedAt: new Date().toISOString(), windowHours: hours, sources: report, items }, null, 1) + '\n');

const failed = report.filter((r) => !r.ok);
console.log(`Swept ${config.sources.length} sources: ${items.length} candidates written to inbox/${date}.json`);
for (const r of report.filter((r) => r.ok).sort((a, b) => b.kept - a.kept)) console.log(`  ok    ${r.source}: ${r.kept} new of ${r.items}`);
for (const r of failed) console.log(`  fail  ${r.source}: ${r.error}`);
