// What counts as "the same item": the same page, the same paper under another link
// (a publisher URL, doi.org, arXiv abs, pdf or html), or the same title. Used by the
// sweep to drop what was already featured, by the validator to refuse a repeat in the
// lab, and by prune to remember items after their issue is deleted.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const squash = (s) => String(s ?? '').toLowerCase().replace(/&amp;/g, '&').replace(/[^\p{L}\p{N}]+/gu, '');

export function keysOf(url, title) {
  const keys = new Set();
  const raw = String(url ?? '');
  if (raw) {
    try {
      const u = new URL(raw);
      for (const k of [...u.searchParams.keys()]) if (/^(utm_|ref$|source$|fbclid|gclid|af$)/.test(k)) u.searchParams.delete(k);
      u.searchParams.sort();
      const q = u.searchParams.toString();
      keys.add(`url:${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/$/, '')}${q ? `?${q}` : ''}`);
    } catch {}
    let decoded = raw;
    try { decoded = decodeURIComponent(raw); } catch {}
    const doi = decoded.match(/10\.\d{4,9}\/[^\s?#"'<>]+/);
    if (doi) keys.add(`doi:${doi[0].toLowerCase().replace(/[.,;)]+$/, '')}`);
    const arxiv = decoded.match(/arxiv\.org\/(?:abs|pdf|html)\/([a-z.-]*\/?\d{4}\.\d{4,6}|\d{7})/i);
    if (arxiv) keys.add(`arxiv:${arxiv[1].toLowerCase()}`);
  }
  const t = squash(title);
  if (t.length >= 25) keys.add(`title:${t}`);
  return keys;
}

/** Every identity key an issue puts in front of the reader, by kind. */
export function issueKeys(issue) {
  const out = [];
  const add = (kind, id, urls, title) => {
    const keys = new Set();
    for (const u of urls) for (const k of keysOf(u, '')) keys.add(k);
    for (const k of keysOf('', title)) keys.add(k);
    out.push({ kind, id, keys, date: issue.date });
  };
  for (const b of issue.blocks ?? []) add('block', b.id, (b.sources ?? []).map((s) => s.url), '');
  for (const p of issue.lab ?? []) add('lab', p.id, (p.links ?? []).map((l) => l.url), p.title);
  for (const s of issue.sparks ?? []) add('spark', s.id, [s.url], '');
  for (const t of issue.ticker ?? []) add('ticker', t.url, [t.url], '');
  return out;
}

const SEEN_DAYS = 90;

export function readSeen(root) {
  const f = join(root, 'data', 'seen.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
}

/** Fold every kept issue and week into data/seen.json so items are remembered after pruning. */
export function updateSeen(root, today = new Date().toISOString().slice(0, 10)) {
  const seen = readSeen(root);
  const issueDir = join(root, 'data', 'issues');
  if (existsSync(issueDir)) {
    for (const f of readdirSync(issueDir).filter((f) => f.endsWith('.json'))) {
      const issue = JSON.parse(readFileSync(join(issueDir, f), 'utf8'));
      for (const { keys, date } of issueKeys(issue)) for (const k of keys) if (!seen[k] || seen[k] > date) seen[k] = date;
    }
  }
  const weekDir = join(root, 'data', 'weeks');
  if (existsSync(weekDir)) {
    for (const f of readdirSync(weekDir).filter((f) => f.endsWith('.json'))) {
      const week = JSON.parse(readFileSync(join(weekDir, f), 'utf8'));
      const urls = [...(week.threads ?? []).flatMap((t) => (t.sources ?? []).map((s) => s.url)), ...(week.deepRead?.links ?? []).map((l) => l.url)];
      for (const u of urls) for (const k of keysOf(u, '')) if (!seen[k] || seen[k] > week.to) seen[k] = week.to;
      if (week.deepRead?.title) for (const k of keysOf('', week.deepRead.title)) if (!seen[k] || seen[k] > week.to) seen[k] = week.to;
    }
  }
  const cutoff = new Date(Date.parse(`${today}T12:00:00Z`) - SEEN_DAYS * 86400_000).toISOString().slice(0, 10);
  for (const [k, d] of Object.entries(seen)) if (d < cutoff) delete seen[k];
  const sorted = Object.fromEntries(Object.entries(seen).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(join(root, 'data', 'seen.json'), JSON.stringify(sorted, null, 1) + '\n');
  return sorted;
}
