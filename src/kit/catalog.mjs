// The print shop: every ink, paper and type set an issue may be printed with.
// Plain JS so the Astro build and the Node scripts share one copy.
//
// The daily theme names ids from these tables, never raw colors. That keeps the
// variety (a new combination every day) inside a palette whose contrast is
// checked, so a creative choice can never produce an unreadable page.

/** Bright inks: display type, art, fills and highlights. */
export const INKS = {
  'fluoro-pink': { name: 'Fluorescent Pink', hex: '#FF48B0' },
  'yellow': { name: 'Yellow', hex: '#FFE800' },
  'sunflower': { name: 'Sunflower', hex: '#FFB511' },
  'orange': { name: 'Orange', hex: '#FF6C2F' },
  'bright-red': { name: 'Bright Red', hex: '#F15060' },
  'coral': { name: 'Fluorescent Orange', hex: '#FF7477' },
  'green': { name: 'Green', hex: '#00A95C' },
  'kelly': { name: 'Kelly Green', hex: '#67B346' },
  'teal': { name: 'Teal', hex: '#00838A' },
  'aqua': { name: 'Aqua', hex: '#5EC8E5' },
  'mint': { name: 'Mint', hex: '#82D8D5' },
  'blue': { name: 'Blue', hex: '#0078BF' },
  'cornflower': { name: 'Cornflower', hex: '#62A8E5' },
  'medium-blue': { name: 'Medium Blue', hex: '#3255A4' },
  'purple': { name: 'Purple', hex: '#765BA7' },
  'violet': { name: 'Violet', hex: '#9D7AD2' },
};

/** Dark inks: body text. Every one clears 7:1 on every paper below. */
export const TEXT_INKS = {
  'black': { name: 'Black', hex: '#000000' },
  'federal-blue': { name: 'Federal Blue', hex: '#2E3F6E' },
  'burgundy': { name: 'Burgundy', hex: '#6B2F52' },
  'hunter': { name: 'Hunter Green', hex: '#24493A' },
  'brown': { name: 'Brown', hex: '#5A3A2E' },
};

/** Paper stocks. `night` is the dark-mode paper for each. */
export const PAPERS = {
  'bright-white': { name: 'Bright White', hex: '#FBFBF8', night: '#16171B' },
  'sky': { name: 'Sky', hex: '#E3EEF4', night: '#121A20' },
  'mint': { name: 'Mint', hex: '#E2F2EA', night: '#121B17' },
  'blush': { name: 'Blush', hex: '#FBE7EA', night: '#1D1417' },
  'fog': { name: 'Fog', hex: '#E9E9E6', night: '#18181A' },
  'butter': { name: 'Butter', hex: '#FFF6CC', night: '#1C1A12' },
  'lilac': { name: 'Lilac', hex: '#ECE6F6', night: '#18151F' },
};

/** Display faces. Body text is always Literata: one familiar reading voice. */
export const TYPE_SETS = {
  poster: {
    name: 'Big Shoulders',
    display: "'Big Shoulders Display Variable', 'Arial Narrow', sans-serif",
    displayWeight: 800, displayStretch: '100%', tracking: '-0.01em', caseUpper: true, scale: 1.18,
  },
  wide: {
    name: 'Anybody Expanded',
    display: "'Anybody Variable', 'Arial Black', sans-serif",
    displayWeight: 760, displayStretch: '135%', tracking: '-0.03em', caseUpper: false, scale: 0.86,
  },
  grotesk: {
    name: 'Bricolage Grotesque',
    display: "'Bricolage Grotesque Variable', 'Helvetica Neue', sans-serif",
    displayWeight: 700, displayStretch: '100%', tracking: '-0.035em', caseUpper: false, scale: 1,
  },
  condensed: {
    name: 'Anybody Condensed',
    display: "'Anybody Variable', 'Arial Narrow', sans-serif",
    displayWeight: 820, displayStretch: '62%', tracking: '-0.01em', caseUpper: true, scale: 1.12,
  },
};

export const SAFE_THEME = { paper: 'bright-white', text: 'black', inks: ['blue', 'fluoro-pink'], type: 'grotesk' };

// WCAG relative luminance and contrast ratio.
function channel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Mix two hex colors; t=0 gives a, t=1 gives b. */
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
}

/**
 * Resolve a theme into concrete colors with a role for each ink. An ink only
 * sets type when it clears 3:1 (large text) against the paper; otherwise that
 * role falls back to the text ink and the ink stays in fills and art.
 */
export function resolveTheme(theme) {
  const t = { ...SAFE_THEME, ...theme };
  const paper = PAPERS[t.paper] ?? PAPERS[SAFE_THEME.paper];
  const text = TEXT_INKS[t.text] ?? TEXT_INKS[SAFE_THEME.text];
  const inks = (t.inks ?? []).map((id) => INKS[id]).filter(Boolean);
  while (inks.length < 2) inks.push(INKS[SAFE_THEME.inks[inks.length]]);
  const type = TYPE_SETS[t.type] ?? TYPE_SETS[SAFE_THEME.type];
  const [a, b] = inks;

  const pick = (ink, bg, fallback, min = 3) => (contrast(ink.hex, bg) >= min ? ink.hex : fallback);
  // Night: paper becomes the dark stock, text becomes the day paper.
  const night = { paper: paper.night, text: paper.hex };
  return {
    ids: t,
    names: { paper: paper.name, text: text.name, a: a.name, b: b.name, type: type.name },
    type,
    day: {
      paper: paper.hex,
      text: text.hex,
      muted: mix(text.hex, paper.hex, 0.32),
      rule: mix(text.hex, paper.hex, 0.78),
      inkA: a.hex,
      inkB: b.hex,
      displayA: pick(a, paper.hex, text.hex),
      displayB: pick(b, paper.hex, text.hex),
      tintA: mix(a.hex, paper.hex, 0.8),
      tintB: mix(b.hex, paper.hex, 0.8),
    },
    night: {
      paper: night.paper,
      text: night.text,
      muted: mix(night.text, night.paper, 0.35),
      rule: mix(night.text, night.paper, 0.8),
      inkA: a.hex,
      inkB: b.hex,
      displayA: pick(a, night.paper, night.text, 4.5),
      displayB: pick(b, night.paper, night.text, 4.5),
      tintA: mix(a.hex, night.paper, 0.78),
      tintB: mix(b.hex, night.paper, 0.78),
    },
    plate: paper.hex,
  };
}

/** Black or white, whichever reads better on an ink. */
export const onInk = (hex) => (contrast(hex, '#000000') >= contrast(hex, '#FFFFFF') ? '#000000' : '#FFFFFF');

/** Check every theme combination the catalog allows. Used by validate. */
export function auditCatalog() {
  const problems = [];
  for (const [pid, p] of Object.entries(PAPERS)) {
    for (const [tid, t] of Object.entries(TEXT_INKS)) {
      const c = contrast(t.hex, p.hex);
      if (c < 7) problems.push(`text ink ${tid} on paper ${pid} is ${c.toFixed(2)}:1, below 7:1`);
    }
    const nc = contrast(p.hex, p.night);
    if (nc < 7) problems.push(`night text on ${pid} is ${nc.toFixed(2)}:1, below 7:1`);
  }
  return problems;
}
