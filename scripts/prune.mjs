#!/usr/bin/env node
// Retention: keep the newest 7 daily issues (with their art, bespoke pages and
// inbox files) and the newest 4 weekly summaries. Everything older is deleted.
import { readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KEEP_DAYS = 7;
const KEEP_WEEKS = 4;
const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dry = process.argv.includes('--dry');
const removed = [];

const rm = (p) => {
  removed.push(p.slice(root.length));
  if (!dry) rmSync(p, { recursive: true, force: true });
};
const names = (dir, re) => (existsSync(dir) ? readdirSync(dir).filter((f) => re.test(f)).sort().reverse() : []);

const issueDir = join(root, 'data', 'issues');
const dates = names(issueDir, /^\d{4}-\d{2}-\d{2}\.json$/).map((f) => f.slice(0, 10));
const keep = new Set(dates.slice(0, KEEP_DAYS));
const cutoff = [...keep].sort()[0] ?? '9999';

for (const d of dates) if (!keep.has(d)) rm(join(issueDir, `${d}.json`));
for (const folder of ['public/art', 'public/bespoke']) {
  const dir = join(root, folder);
  for (const d of names(dir, /^\d{4}-\d{2}-\d{2}$/)) if (!keep.has(d)) rm(join(dir, d));
}
// Inbox files are kept for the same window so the run can see what it already considered.
const inbox = join(root, 'inbox');
for (const f of names(inbox, /^\d{4}-\d{2}-\d{2}\.json$/)) if (f.slice(0, 10) < cutoff) rm(join(inbox, f));

const weekDir = join(root, 'data', 'weeks');
for (const f of names(weekDir, /^\d{4}-W\d{2}\.json$/).slice(KEEP_WEEKS)) rm(join(weekDir, f));

console.log(removed.length ? `${dry ? 'Would remove' : 'Removed'}:\n  ${removed.join('\n  ')}` : 'Nothing to prune.');
