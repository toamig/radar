#!/usr/bin/env node
// The free first pass: read every source in config/sources.json, keep what was
// published inside its window, drop anything already featured this week, give
// each item a rough score, and write inbox/<date>.json for triage and the
// morning run. No model is involved; this step only casts the net.
//
// Every source feeds one section of the issue:
//   news      the main grid and the ticker
//   research  The lab (papers, theses, lab reports)
//   trend     Sparks (rising games, concepts, devlogs, experiments)
//
//   node scripts/sweep.mjs [--date YYYY-MM-DD] [--hours 48]
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { keysOf, issueKeys, readSeen } from './identity.mjs';
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
const UA = 'Mozilla/5.0 (compatible; RadarSweep/1.0; +https://toamig.com/radar/)';
const CAPS = { news: 300, research: 180, trend: 160 };
// No single source or platform fills a section: one source's best items only.
const SOURCE_CAP = { research: 40, trend: 30 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GH_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', processEntities: true, htmlEntities: true });

async function get(url, accept = 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*', headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept, ...headers }, signal: AbortSignal.timeout(20_000), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
const json = async (url, headers) => JSON.parse(await get(url, 'application/json', headers));

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
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** Post HTML to plain text: hashtags and links stay whole, paragraphs become spaces. */
const postText = (html) =>
  String(html ?? '')
    .replace(/<br\s*\/?>|<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
      return entities[e.toLowerCase()] ?? m;
    })
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
  if (!rssItems && (doc?.rss?.channel || doc?.['rdf:RDF'])) return [];
  if (rssItems) {
    return [].concat(rssItems).map((it) => ({
      title: strip(it.title),
      url: linkOf(it.link) || text(it.guid),
      published: text(it.pubDate ?? it['dc:date'] ?? it.published),
      summary: strip(it.description ?? it['content:encoded'] ?? ''),
    }));
  }
  if (doc?.feed && !doc.feed.entry) return [];
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

const now = new Date().toISOString();

// Reddit allows about one unauthenticated request per minute per IP, and a shared
// runner address has usually spent it already. So the subreddits are read as a few
// grouped feeds (r/a+b+c), one every 65 seconds, waiting out the limit on a 429.
let lastReddit = 0;
async function redditGet(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = lastReddit + 65_000 - Date.now();
    if (wait > 0) await sleep(wait);
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/atom+xml, */*' }, signal: AbortSignal.timeout(25_000) });
    lastReddit = Date.now();
    if (res.ok) return res.text();
    if (res.status !== 429) throw new Error(`HTTP ${res.status}`);
    await sleep((Number(res.headers.get('x-ratelimit-reset')) || 60) * 1000 + 3000);
    lastReddit = 0;
  }
  throw new Error('HTTP 429 after waiting twice');
}


async function readSource(src) {
  if (src.kind === 'rss') return parseFeed(await get(src.url));
  if (src.kind === 'github') return parseFeed(await get(`https://github.com/${src.repo}/releases.atom`));
  if (src.kind === 'reddit') {
    const url = `https://www.reddit.com/r/${src.subs.join('+')}/top/.rss?t=${src.t ?? 'day'}&limit=100`;
    const doc = parser.parse(await redditGet(url));
    if (!doc?.feed) throw new Error('not an Atom feed');
    const seen = {};
    const out = [];
    for (const it of [].concat(doc.feed.entry ?? [])) {
      const sub = it.category?.['@label'] ?? `r/${it.category?.['@term'] ?? 'reddit'}`;
      const rank = (seen[sub] = (seen[sub] ?? 0) + 1);
      if (rank > (src.perSub ?? 8)) continue;
      out.push({
        title: strip(it.title),
        url: linkOf(it.link),
        published: text(it.published ?? it.updated),
        summary: strip(it.content ?? it.summary ?? '').slice(0, 480),
        signal: `#${rank} of the ${src.t === 'week' ? 'week' : 'day'}'s top posts on ${sub}`,
        source: sub,
        boost: Math.max(0, 1.6 - rank * 0.16),
      });
    }
    return out;
  }
  if (src.kind === 'arxiv') {
    // The API answers every day; the RSS feeds are empty at weekends.
    const q = src.query ?? `cat:${src.cat}`;
    const xml = await get(`https://export.arxiv.org/api/query?search_query=${encodeURIComponent(q)}&sortBy=submittedDate&sortOrder=descending&max_results=${src.max ?? 100}`);
    return parseFeed(xml).map((it) => ({ ...it, url: it.url.replace(/^http:/, 'https:').replace(/v\d+$/, '') }));
  }
  if (src.kind === 'mastodon') {
    // Hashtag timelines, ranked by how much people engaged with each post.
    const out = [];
    for (const tag of src.tags) {
      try {
        for (const p of await json(`https://${src.instance}/api/v1/timelines/tag/${tag}?limit=40`)) {
          const score = p.favourites_count + 2 * p.reblogs_count;
          const body = postText(p.content);
          if (score < (src.minScore ?? 8) || body.length < 30) continue;
          out.push({
            title: clip(body, 160),
            url: p.url,
            published: p.created_at,
            summary: clip(`${body}${p.card?.title ? ` Link: ${p.card.title} (${p.card.url})` : ''}`, 480),
            signal: `${p.favourites_count} favourites and ${p.reblogs_count} boosts on Mastodon (#${tag})`,
            source: `Mastodon #${tag}`,
            boost: Math.min(1.8, Math.log10(score + 1)),
          });
        }
      } catch {}
      await sleep(400);
    }
    return out;
  }
  if (src.kind === 'bluesky') {
    // Public custom feeds on Bluesky, kept when a post has real engagement.
    const out = [];
    for (const f of src.feeds) {
      try {
        const data = await json(`https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(f.uri)}&limit=100`);
        for (const { post } of data.feed) {
          const likes = post.likeCount ?? 0;
          const reposts = post.repostCount ?? 0;
          const score = likes + 2 * reposts;
          const body = String(post.record?.text ?? '').trim();
          if (score < (f.minScore ?? src.minScore ?? 25) || body.length < 30) continue;
          const ext = post.embed?.external ?? post.embed?.media?.external;
          out.push({
            title: clip(body.replace(/\s+/g, ' '), 160),
            url: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`,
            published: post.record?.createdAt ?? post.indexedAt,
            summary: clip(`${body}${ext ? ` Link: ${ext.title ?? ''} (${ext.uri})` : ''}`, 480),
            signal: `${likes} likes and ${reposts} reposts on Bluesky (${f.name})`,
            source: `Bluesky ${f.name}`,
            boost: Math.min(1.8, Math.log10(score + 1) * 0.8),
          });
        }
      } catch {}
      await sleep(300);
    }
    return out;
  }
  if (src.kind === 'youtube') {
    // Channel feeds carry view counts, so a fast riser stands out.
    const out = [];
    for (const ch of src.channels) {
      try {
        const doc = parser.parse(await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`));
        for (const e of [].concat(doc?.feed?.entry ?? [])) {
          const group = e['media:group'] ?? {};
          const views = Number(group['media:community']?.['media:statistics']?.['@views'] ?? 0);
          out.push({
            title: strip(e.title),
            url: linkOf(e.link),
            published: text(e.published),
            summary: clip(strip(group['media:description'] ?? ''), 400),
            signal: `${views.toLocaleString('en-US')} views on ${ch.name}'s channel`,
            source: `YouTube: ${ch.name}`,
            lane: ch.lane,
            boost: Math.min(2, Math.log10(views + 1) / 3),
          });
        }
      } catch {}
      await sleep(150);
    }
    return out;
  }
  if (src.kind === 'devto') {
    const out = [];
    for (const tag of src.tags) {
      try {
        for (const a of await json(`https://dev.to/api/articles?top=${src.days ?? 7}&tag=${tag}&per_page=30`)) {
          if (a.public_reactions_count < (src.minReactions ?? 40)) continue;
          out.push({
            title: a.title,
            url: a.canonical_url || a.url,
            published: a.published_at,
            summary: strip(a.description ?? ''),
            signal: `${a.public_reactions_count} reactions and ${a.comments_count} comments on DEV (#${tag})`,
            points: a.public_reactions_count,
            comments: a.comments_count,
          });
        }
      } catch {}
      await sleep(300);
    }
    return out;
  }
  if (src.kind === 'ghtrending') {
    // New repositories (created within the window) that gathered the most stars.
    const days = src.days ?? 7;
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    const out = [];
    for (const topic of src.topics) {
      try {
        const q = `topic:${topic} created:>${since} stars:>${src.minStars ?? 60}`;
        const data = await json(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=8`, GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {});
        for (const r of data.items) {
          out.push({
            title: `${r.full_name}: ${r.description ?? 'no description'}`,
            url: r.html_url,
            published: r.created_at,
            summary: clip(`${r.description ?? ''} Topics: ${(r.topics ?? []).join(', ')}. Language: ${r.language ?? 'n/a'}.`, 480),
            signal: `${r.stargazers_count.toLocaleString('en-US')} stars since it was created ${r.created_at.slice(0, 10)}`,
            points: r.stargazers_count,
            windowDays: days,
          });
        }
      } catch {}
      await sleep(2200);
    }
    return out;
  }
  if (src.kind === 'hn') {
    const after = Math.floor((Date.now() - hours * 3600_000) / 1000);
    const q = src.query ? `&query=${encodeURIComponent(src.query)}` : '';
    const data = await json(`https://hn.algolia.com/api/v1/search?tags=${src.tags ?? 'story'}&hitsPerPage=100${q}&numericFilters=created_at_i>${after},points>${src.minPoints ?? 100}`);
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
  if (src.kind === 'hfpapers') {
    // Hugging Face's daily papers: community-upvoted arXiv papers, with code links.
    const days = Math.ceil(hours / 24) + 1;
    const out = [];
    for (let d = 0; d < days; d++) {
      const day = new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10);
      try {
        for (const p of await json(`https://huggingface.co/api/daily_papers?date=${day}&limit=100`)) {
          out.push({
            title: p.paper.title,
            url: `https://arxiv.org/abs/${p.paper.id}`,
            published: p.paper.submittedOnDailyAt ?? p.publishedAt,
            summary: strip(p.paper.summary ?? ''),
            points: p.paper.upvotes ?? 0,
            code: p.paper.githubRepo ?? undefined,
            signal: `${p.paper.upvotes ?? 0} upvotes on Hugging Face papers${p.paper.githubRepo ? ', code released' : ''}`,
          });
        }
      } catch {}
    }
    return out;
  }
  if (src.kind === 'openalex') {
    // Recent dissertations and theses matching a search, via the open OpenAlex index.
    const from = new Date(Date.now() - (src.days ?? 45) * 86400_000).toISOString().slice(0, 10);
    const out = [];
    for (const q of src.queries) {
      const data = await json(`https://api.openalex.org/works?filter=type:dissertation,from_publication_date:${from}&search=${encodeURIComponent(q)}&per-page=10&sort=publication_date:desc`);
      for (const w of data.results) {
        const words = w.abstract_inverted_index
          ? Object.entries(w.abstract_inverted_index).flatMap(([word, pos]) => pos.map((p) => [p, word])).sort((a, b) => a[0] - b[0]).map((x) => x[1]).join(' ')
          : '';
        out.push({
          title: w.display_name,
          url: w.primary_location?.landing_page_url ?? w.doi ?? w.id,
          published: `${w.publication_date}T12:00:00Z`,
          summary: `${w.authorships?.[0]?.institutions?.map((i) => i.display_name).join(', ') ?? ''}. ${words}`.trim(),
          signal: `PhD or master's thesis (${q})`,
          windowDays: src.days ?? 45,
        });
      }
    }
    return out;
  }
  if (src.kind === 'steam') {
    // What is rising on Steam: big climbers in the most-played chart, the most
    // wishlisted upcoming games, and the store's current top sellers.
    const out = [];
    const charts = await json('https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/');
    const climbers = charts.response.ranks
      .filter((r) => r.rank <= 100 && (r.last_week_rank === 0 || r.last_week_rank - r.rank >= (src.minClimb ?? 15)))
      .slice(0, 8);
    for (const r of climbers) {
      try {
        const info = (await json(`https://store.steampowered.com/api/appdetails?appids=${r.appid}&filters=basic,genres`))[r.appid]?.data;
        if (!info) continue;
        const moved = r.last_week_rank === 0 ? 'new to Steam\'s top 100 most played this week' : `up ${r.last_week_rank - r.rank} places to #${r.rank} in Steam's most played`;
        out.push({
          title: info.name,
          url: `https://store.steampowered.com/app/${r.appid}/`,
          published: now,
          summary: strip(info.short_description ?? ''),
          signal: `${moved}, peak ${r.peak_in_game.toLocaleString('en-US')} players`,
          appid: r.appid,
        });
      } catch {}
    }
    const wish = await json('https://store.steampowered.com/search/results/?filter=popularwishlist&json=1&count=15');
    wish.items.forEach((it, i) => {
      const appid = it.logo.match(/apps\/(\d+)\//)?.[1];
      if (appid) out.push({ title: it.name, url: `https://store.steampowered.com/app/${appid}/`, published: now, summary: '', signal: `#${i + 1} most wishlisted upcoming game on Steam`, appid: Number(appid) });
    });
    return out;
  }
  throw new Error(`unknown kind ${src.kind}`);
}

// Everything already featured in the kept issues, and remembered for 90 days in data/seen.json
// after its issue is pruned, so the same story or paper is not offered again under another link.
const featured = new Set();
for (const k of Object.keys(readSeen(root))) featured.add(k);
const issueDir = join(root, 'data', 'issues');
if (existsSync(issueDir)) {
  for (const f of readdirSync(issueDir).filter((f) => f.endsWith('.json'))) {
    try {
      const issue = JSON.parse(readFileSync(join(issueDir, f), 'utf8'));
      for (const { keys } of issueKeys(issue)) for (const k of keys) featured.add(k);
    } catch {}
  }
}

const results = [];
const report = [];
// Reddit and arXiv ask for one reader at a time, so each gets its own slow lane.
const isReddit = (src) => src.kind === 'reddit';
const isArxiv = (src) => src.kind === 'arxiv';
const queue = config.sources.filter((s) => !isReddit(s) && !isArxiv(s));
const redditLane = config.sources.filter(isReddit);
const arxivLane = config.sources.filter(isArxiv);

async function worker(list = queue, pause = 0) {
  while (list.length) {
    const src = list.shift();
    if (pause) await new Promise((r) => setTimeout(r, pause));
    const t0 = Date.now();
    const section = src.section ?? 'news';
    const match = src.match ? new RegExp(src.match, 'i') : null;
    try {
      const items = await readSource(src);
      let kept = 0;
      for (const it of items) {
        const ts = Date.parse(it.published);
        const windowMs = (it.windowDays ? it.windowDays * 24 : src.windowHours ?? hours) * 3600_000;
        if (!it.title || !it.url || Number.isNaN(ts) || ts < Date.now() - windowMs) continue;
        if (match && !match.test(`${it.title} ${it.summary ?? ''}`)) continue;
        const url = normalize(it.url);
        if ([...keysOf(it.url, it.title)].some((k) => featured.has(k))) continue;
        kept++;
        results.push({
          section,
          title: clip(it.title, 200),
          url,
          source: it.source ?? src.name,
          lane: it.lane ?? src.lane,
          published: new Date(ts).toISOString(),
          summary: clip(it.summary ?? '', 480),
          ...(it.signal && { signal: it.signal }),
          ...(it.code && { code: it.code }),
          ...(it.appid && { appid: it.appid }),
          ...(it.boost && { boost: Math.round(it.boost * 100) / 100 }),
          ...(it.points != null && { points: it.points, comments: it.comments, discussion: it.discussion }),
          weight: src.weight ?? 1,
        });
      }
      report.push({ source: src.name, section, ok: true, items: items.length, kept, ms: Date.now() - t0 });
    } catch (e) {
      report.push({ source: src.name, section, ok: false, error: String(e.message ?? e).slice(0, 120) });
    }
  }
}
await Promise.all([...Array.from({ length: 8 }, () => worker()), worker(redditLane), worker(arxivLane, 3500)]);

// Merge duplicates (same URL from two feeds) and score.
const byUrl = new Map();
for (const it of results) {
  const prev = byUrl.get(it.url);
  if (prev) {
    prev.alsoIn = [...new Set([...(prev.alsoIn ?? []), it.source])];
    prev.weight = Math.max(prev.weight, it.weight) + 0.5;
    if (it.points != null) Object.assign(prev, { points: it.points, comments: it.comments, discussion: it.discussion ?? prev.discussion });
    if (it.signal && !prev.signal) prev.signal = it.signal;
  } else byUrl.set(it.url, { ...it });
}
const scored = [...byUrl.values()].map((it) => {
  const ageH = (Date.now() - Date.parse(it.published)) / 3600_000;
  const fresh = it.section === 'news' ? Math.max(0.3, 1 - ageH / (hours * 1.2)) : 1;
  const buzz = it.points ? Math.log10(it.points + 1) + Math.log10((it.comments ?? 0) + 1) * 0.5 : 0;
  return { ...it, score: Math.round((it.weight * 2 + buzz + (it.boost ?? 0)) * fresh * 100) / 100 };
});
const items = [];
for (const section of Object.keys(CAPS)) {
  const ranked = scored.filter((it) => it.section === section).sort((a, b) => b.score - a.score);
  if (!SOURCE_CAP[section]) {
    ranked.slice(0, CAPS[section]).forEach((it) => items.push(it));
    continue;
  }
  // Research and trends draw from dozens of very different sources. Taking the top
  // scores alone would let the buzziest ones (stars, upvotes) crowd out the rest, so
  // each source gives its best item in turn until the section is full.
  const lanes = new Map();
  for (const it of ranked) {
    const list = lanes.get(it.source) ?? [];
    if (list.length < SOURCE_CAP[section]) list.push(it);
    lanes.set(it.source, list);
  }
  const picked = [];
  for (let round = 0; picked.length < CAPS[section]; round++) {
    let any = false;
    for (const list of lanes.values()) {
      if (list[round] && picked.length < CAPS[section]) { picked.push(list[round]); any = true; }
    }
    if (!any) break;
  }
  picked.sort((a, b) => b.score - a.score).forEach((it) => items.push(it));
}
items.forEach((it, i) => { it.id = `c${String(i + 1).padStart(3, '0')}`; });

mkdirSync(join(root, 'inbox'), { recursive: true });
const out = join(root, 'inbox', `${date}.json`);
const ordered = items.map(({ id, ...rest }) => ({ id, ...rest }));
writeFileSync(out, JSON.stringify({ date, generatedAt: now, windowHours: hours, sources: report, items: ordered }, null, 1) + '\n');

const counts = Object.keys(CAPS).map((s) => `${items.filter((i) => i.section === s).length} ${s}`).join(', ');
console.log(`Swept ${config.sources.length} sources: ${counts}, written to inbox/${date}.json`);
for (const r of report.filter((r) => r.ok).sort((a, b) => b.kept - a.kept)) console.log(`  ok    [${r.section}] ${r.source}: ${r.kept} new of ${r.items}`);
for (const r of report.filter((r) => !r.ok)) console.log(`  fail  [${r.section}] ${r.source}: ${r.error}`);
