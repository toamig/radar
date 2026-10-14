// Inline markup for issue text: **bold**, `code` and [label](https://url).
// Parsed into tokens that components render as escaped text, so nothing in an
// issue file can ever become raw HTML on the page.

export type Token =
  | { t: 'text'; v: string }
  | { t: 'b'; v: string }
  | { t: 'code'; v: string }
  | { t: 'a'; v: string; href: string };

const PATTERN = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;

export function inline(src: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of src.matchAll(PATTERN)) {
    if (m.index! > last) out.push({ t: 'text', v: src.slice(last, m.index) });
    if (m[1]) out.push({ t: 'b', v: m[1] });
    else if (m[2]) out.push({ t: 'code', v: m[2] });
    else out.push({ t: 'a', v: m[3], href: m[4] });
    last = m.index! + m[0].length;
  }
  if (last < src.length) out.push({ t: 'text', v: src.slice(last) });
  return out;
}

/** Plain text with the markup stripped, for meta tags and word counts. */
export function plain(src: string): string {
  return inline(src).map((tok) => tok.v).join('');
}
