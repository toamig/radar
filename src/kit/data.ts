// Loads the issue and week files, validates them, and applies retention: the
// site only ever shows the last 7 daily issues and the last 4 weekly
// summaries, whatever else is still on disk.
import { Issue, Week } from './schema.mjs';
import type { z } from 'zod';
import { plain } from './inline';

export type IssueData = z.infer<typeof Issue>;
export type WeekData = z.infer<typeof Week>;
export type BlockData = IssueData['blocks'][number];

export const KEEP_DAYS = 7;
export const KEEP_WEEKS = 4;

function load<T>(files: Record<string, unknown>, schema: { safeParse: (v: unknown) => any }, kind: string): T[] {
  return Object.entries(files).map(([path, mod]) => {
    const raw = (mod as { default?: unknown }).default ?? mod;
    const res = schema.safeParse(raw);
    if (!res.success) {
      const detail = res.error.issues.map((i: any) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`${kind} ${path} failed validation:\n${detail}`);
    }
    return res.data as T;
  });
}

const issueFiles = import.meta.glob('/data/issues/*.json', { eager: true });
const weekFiles = import.meta.glob('/data/weeks/*.json', { eager: true });

export const issues: IssueData[] = load<IssueData>(issueFiles, Issue, 'Issue')
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, KEEP_DAYS);

export const weeks: WeekData[] = load<WeekData>(weekFiles, Week, 'Week')
  .sort((a, b) => b.id.localeCompare(a.id))
  .slice(0, KEEP_WEEKS);

export const latest = issues[0];

/** Every text field in a block, for the reading-time estimate. */
function blockWords(b: BlockData): number {
  const parts: string[] = [b.title, b.why];
  const any = b as Record<string, any>;
  for (const key of ['takeaway', 'gist', 'background', 'what', 'intro', 'plain', 'context', 'quote', 'verdict', 'note']) {
    if (typeof any[key] === 'string') parts.push(any[key]);
  }
  for (const key of ['body', 'explain', 'points', 'deep']) if (Array.isArray(any[key])) parts.push(...any[key]);
  for (const key of ['steps', 'items', 'events', 'rows']) {
    if (Array.isArray(any[key])) for (const it of any[key]) parts.push(...Object.values(it).filter((v) => typeof v === 'string') as string[]);
  }
  return parts.map(plain).join(' ').split(/\s+/).length;
}

/** Minutes to read one block, for its label. */
export function blockMinutes(b: BlockData): number {
  return Math.max(1, Math.round(blockWords(b) / 230));
}

export function readingMinutes(issue: IssueData): number {
  const words = issue.blocks.reduce((n, b) => n + blockWords(b), 0) + issue.tldr.map((t) => t.text).join(' ').split(/\s+/).length;
  return Math.max(2, Math.round(words / 230));
}

export function formatDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
}

export const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const asset = (p: string) => `${BASE}${p}`;
