// Plain definitions for technical words. Each block (and Learn one thing)
// carries its terms in data-terms; the first use of each term in that block's
// reading text becomes a dotted word that shows its definition on hover, tap or
// keyboard focus. Without JavaScript, the block's terms list shows instead.

type Term = { term: string; def: string };

const SKIP = 'h1, h2, h3, code, pre, a, button, summary, .srcs, .tune, .b-top, figcaption, .term, .terms-list, .kind-tag, .dia, .chart, .learn-q';
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tip = document.createElement('div');
tip.id = 'radar-tip';
tip.setAttribute('role', 'tooltip');
tip.hidden = true;
document.body.append(tip);

function markTerms(root: HTMLElement, terms: Term[]) {
  // Longest first, so "prompt injection" wins over "prompt".
  for (const { term, def } of [...terms].sort((a, b) => b.term.length - a.term.length)) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escape(term)})(?![\\p{L}\\p{N}])`, 'iu');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      const m = re.exec(node.data);
      if (!m) continue;
      const start = m.index + m[1].length;
      const word = node.splitText(start);
      word.splitText(m[2].length);
      const span = document.createElement('span');
      span.className = 'term';
      span.tabIndex = 0;
      span.dataset.term = term;
      span.dataset.def = def;
      span.setAttribute('aria-describedby', 'radar-tip');
      word.replaceWith(span);
      span.append(word);
      break;
    }
  }
}

function show(el: HTMLElement) {
  tip.replaceChildren();
  const b = document.createElement('b');
  b.textContent = el.dataset.term ?? '';
  tip.append(b, document.createTextNode(` ${el.dataset.def ?? ''}`));
  tip.hidden = false;
  const r = el.getBoundingClientRect();
  const w = Math.min(320, window.innerWidth - 24);
  tip.style.width = `${w}px`;
  const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
  const below = r.bottom + 10;
  const h = tip.offsetHeight;
  const top = below + h > window.innerHeight - 80 ? r.top - h - 10 : below;
  tip.style.left = `${left + window.scrollX}px`;
  tip.style.top = `${top + window.scrollY}px`;
}
const hide = () => { tip.hidden = true; };

document.querySelectorAll<HTMLElement>('[data-terms]').forEach((root) => {
  try { markTerms(root, JSON.parse(root.dataset.terms ?? '[]')); } catch {}
});
document.addEventListener('mouseover', (e) => {
  const t = (e.target as HTMLElement).closest?.('.term') as HTMLElement | null;
  if (t) show(t);
});
document.addEventListener('mouseout', (e) => {
  if ((e.target as HTMLElement).closest?.('.term') && document.activeElement !== e.target) hide();
});
document.addEventListener('focusin', (e) => {
  const t = (e.target as HTMLElement).closest?.('.term') as HTMLElement | null;
  if (t) show(t); else hide();
});
document.addEventListener('focusout', (e) => { if ((e.target as HTMLElement).closest?.('.term')) hide(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
