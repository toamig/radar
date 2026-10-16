// A small public feed of the newest issue, for other pages on toamig.com (the
// portfolio's Toa Radar teaser) to show today's headline in today's inks.
import type { APIRoute } from 'astro';
import { BASE, latest } from '../kit/data';
import { resolveTheme } from '../kit/catalog.mjs';
import { plain } from '../kit/inline';

export const GET: APIRoute = ({ site }) => {
  if (!latest) return new Response(JSON.stringify({ issue: null }), { headers: { 'Content-Type': 'application/json' } });
  const t = resolveTheme(latest.theme);
  const url = (p: string) => new URL(`${BASE}${p}`, site).href;
  const body = {
    name: 'Toa Radar',
    by: 'Toamig',
    issue: {
      number: latest.number,
      date: latest.date,
      title: plain(latest.title),
      dek: plain(latest.dek),
      tldr: latest.tldr.map((x) => plain(x.text)),
      url: url(`${latest.date}/`),
      home: url(''),
      card: url(`og/${latest.date}.jpg`),
    },
    theme: {
      paper: t.day.paper,
      text: t.day.text,
      inkA: t.day.inkA,
      inkB: t.day.inkB,
      displayA: t.day.displayA,
      night: { paper: t.night.paper, text: t.night.text },
      font: t.names.type,
    },
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { 'Content-Type': 'application/json' } });
};
