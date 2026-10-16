// The TOA monogram from toamig.com: one copy of its outline, shared by the
// masthead, the share cards and the per-issue favicon. Its parts are printed in
// the day's inks: the T in one, the O and A in the other.
export const TOA_VIEWBOX = '50 146 597 340';
export const TOA_TRANSFORM = 'translate(0,633) scale(0.1,-0.1)';
export const TOA_PATHS = [
  {
    "part": "t",
    "d": "M507 4863 c-4 -3 -7 -152 -7 -330 l0 -323 335 0 335 0 0 -1332 0 -1333 330 330 330 330 0 1002 0 1003 999 0 1000 0 323 326 c178 179 325 327 327 330 2 2 -889 4 -1981 4 -1091 0 -1988 -3 -1991 -7z"
  },
  {
    "part": "oa",
    "d": "M4227 4472 l-327 -327 -2 -1005 -3 -1005 -1000 -3 -1000 -2 -330 -330 -330 -330 1658 0 1657 0 0 335 0 335 392 -2 393 -3 123 -215 c68 -118 154 -267 191 -330 l67 -115 377 -3 c207 -1 377 0 377 3 0 2 -22 42 -49 87 -46 77 -1130 1958 -1218 2113 -22 39 -84 147 -138 240 -54 94 -130 226 -170 295 -40 69 -98 170 -130 225 -32 55 -91 158 -132 230 -41 71 -75 130 -76 132 -2 1 -150 -145 -330 -325z m375 -1064 c20 -35 104 -181 187 -325 83 -144 151 -267 151 -273 0 -6 -67 -10 -195 -10 l-195 0 0 335 c0 184 4 335 8 335 4 0 24 -28 44 -62z"
  },
  {
    "part": "oa",
    "d": "M2898 3139 l-318 -324 317 -3 c174 -1 318 -1 320 1 2 2 2 149 1 327 l-3 323 -317 -324z"
  }
];

/** The mark as a standalone SVG in two colors, with an optional square crop for icons. */
export function toaSvg(t, oa, { square = false } = {}) {
  const box = square ? '40 7.5 617 617' : TOA_VIEWBOX;
  const body = TOA_PATHS.map((p) => `<path fill="${p.part === 't' ? t : oa}" d="${p.d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}"><g transform="${TOA_TRANSFORM}">${body}</g></svg>`;
}
