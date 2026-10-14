#!/usr/bin/env node
// Checks everything the daily run writes before it is committed:
// - every issue and week parses against the schema
// - art SVGs and bespoke pages exist and carry nothing that can run or phone home
// - the catalog's contrast guarantees still hold
// - layout rows pack, numbering continues, stories are not repeated within the week
// Exit code 1 on any error; warnings print but pass.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Issue, Week } from '../src/kit/schema.mjs';
import { auditCatalog } from '../src/kit/catalog.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const list = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort() : []);
const readJson = (p) => {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { err(`${p}: not valid JSON (${e.message})`); return null; }
};

for (const p of auditCatalog()) err(`catalog: ${p}`);

// Anything that executes, loads a remote resource, or escapes the frame.
const SVG_BANNED = [
  [/<script/i, 'script element'],
  [/<foreignObject/i, 'foreignObject'],
  [/\son[a-z]+\s*=/i, 'event handler attribute'],
  [/javascript:/i, 'javascript: URL'],
  [/<(iframe|embed|object|audio|video)\b/i, 'embedded content'],
  [/\b(xlink:)?href\s*=\s*["'](?!#)/i, 'external href (only #fragment links allowed)'],
  [/@import/i, '@import'],
  [/url\(\s*["']?(?!#)/i, 'url() to anything but a #fragment'],
];
const BESPOKE_BANNED = [
  [/\b(src|href|action|poster|data)\s*=\s*["']?\s*(https?:)?\/\//i, 'remote resource'],
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon/, 'network access'],
  [/\bimport\s*\(|importScripts/, 'dynamic import'],
  [/\b(window\.)?(top|parent|opener)\s*\.\s*(location|postMessage|document)/, 'reaching outside the frame'],
  [/localStorage|sessionStorage|indexedDB|document\.cookie/, 'storage access'],
  [/<(iframe|embed|object|base|form)\b/i, 'disallowed element'],
  [/http-equiv\s*=\s*["']?refresh/i, 'meta refresh'],
];
const CSP = /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["']default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:["']\s*\/?>/i;

function checkFile(rel, kind) {
  const p = join(root, 'public', rel);
  if (!existsSync(p)) return err(`${kind} ${rel} is referenced but missing`);
  const size = statSync(p).size;
  const src = readFileSync(p, 'utf8');
  if (kind === 'art') {
    if (size > 80_000) err(`art ${rel} is ${size} bytes; keep SVG art under 80 KB`);
    if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(src)) err(`art ${rel} must be a single <svg> document`);
    if (!/viewBox=/.test(src)) warn(`art ${rel} has no viewBox, so it may not scale`);
    for (const [re, what] of SVG_BANNED) if (re.test(src)) err(`art ${rel}: ${what} is not allowed`);
  } else {
    if (size > 200_000) err(`bespoke ${rel} is ${size} bytes; keep it under 200 KB`);
    if (!CSP.test(src)) err(`bespoke ${rel}: must start its <head> with the exact CSP meta tag from routine/FORMATS.md`);
    for (const [re, what] of BESPOKE_BANNED) if (re.test(src)) err(`bespoke ${rel}: ${what} is not allowed`);
  }
}

const WIDTH = { full: 6, wide: 4, half: 3, third: 2 };
function checkRows(issue) {
  let row = 0;
  const rows = [];
  for (const b of issue.blocks) {
    const w = WIDTH[b.size];
    if (row + w > 6) { rows.push(row); row = 0; }
    row += w;
    if (row === 6) { rows.push(row); row = 0; }
  }
  if (row) rows.push(row);
  const ragged = rows.filter((r) => r !== 6).length;
  if (ragged) warn(`${issue.date}: ${ragged} layout row(s) do not fill all 6 columns; sizes in order are ${issue.blocks.map((b) => b.size).join(', ')}`);
}

// ------------------------------------------------------------ issues
const issueDir = join(root, 'data', 'issues');
const issues = [];
for (const f of list(issueDir, '.json')) {
  const raw = readJson(join(issueDir, f));
  if (!raw) continue;
  // House style: no em or en dashes anywhere in the copy.
  if (/[–—]/.test(JSON.stringify(raw))) err(`issues/${f}: contains an em or en dash; rewrite with a period, comma, colon or parentheses`);
  const res = Issue.safeParse(raw);
  if (!res.success) {
    for (const i of res.error.issues) err(`issues/${f}: ${i.path.join('.') || '(root)'}: ${i.message}`);
    continue;
  }
  const issue = res.data;
  if (`${issue.date}.json` !== f) err(`issues/${f}: file name must be the issue date (${issue.date}.json)`);
  for (const b of issue.blocks) {
    if (b.art) checkFile(b.art, 'art');
    if (b.src) checkFile(b.src, 'bespoke');
  }
  checkRows(issue);
  const heroes = issue.blocks.filter((b) => b.format === 'hero').length;
  if (heroes > 1) err(`${issue.date}: only one hero per issue`);
  const lanes = new Set(issue.blocks.map((b) => b.lane));
  if (!lanes.has('gamedev') && !lanes.has('both')) warn(`${issue.date}: no game dev story today`);
  if (!lanes.has('ai') && !lanes.has('both')) warn(`${issue.date}: no AI engineering story today`);
  const formats = new Set(issue.blocks.map((b) => b.format));
  if (formats.size < 5) warn(`${issue.date}: only ${formats.size} different formats; aim for variety`);
  issues.push(issue);
}

issues.sort((a, b) => a.date.localeCompare(b.date));
for (let i = 1; i < issues.length; i++) {
  if (issues[i].number !== issues[i - 1].number + 1) {
    warn(`issue numbers jump from ${issues[i - 1].number} (${issues[i - 1].date}) to ${issues[i].number} (${issues[i].date})`);
  }
}
// The same story should not lead twice in one week.
const seen = new Map();
for (const issue of issues) {
  for (const b of issue.blocks) {
    for (const s of b.sources) {
      const key = s.url.replace(/[?#].*$/, '').replace(/\/$/, '');
      if (seen.has(key) && seen.get(key) !== issue.date) warn(`${issue.date}/${b.id}: source already used on ${seen.get(key)} (${key}); is this a real follow-up?`);
      else seen.set(key, issue.date);
    }
  }
}
const last = issues.at(-1);
if (last && last.theme && issues.length > 1) {
  const prev = issues.at(-2);
  if (prev.theme.inks.join() === last.theme.inks.join()) warn(`${last.date}: same inks as ${prev.date}; pick a new pair`);
}

// ------------------------------------------------------------ weeks
const weekDir = join(root, 'data', 'weeks');
for (const f of list(weekDir, '.json')) {
  const raw = readJson(join(weekDir, f));
  if (!raw) continue;
  const res = Week.safeParse(raw);
  if (!res.success) for (const i of res.error.issues) err(`weeks/${f}: ${i.path.join('.') || '(root)'}: ${i.message}`);
  else if (`${res.data.id}.json` !== f) err(`weeks/${f}: file name must be the week id (${res.data.id}.json)`);
}

// ------------------------------------------------------------ orphans
for (const folder of ['art', 'bespoke']) {
  const dir = join(root, 'public', folder);
  if (!existsSync(dir)) continue;
  for (const day of readdirSync(dir)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const used = new Set(issues.find((i) => i.date === day)?.blocks.flatMap((b) => [b.art, b.src]).filter(Boolean) ?? []);
    for (const f of readdirSync(join(dir, day))) if (!used.has(`${folder}/${day}/${f}`)) warn(`public/${folder}/${day}/${f} is not used by any block`);
  }
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`error ${e}`);
console.log(`\n${issues.length} issue(s) checked: ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
