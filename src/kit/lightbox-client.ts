// Click or tap a picture to see it large. The viewer opens fitted to the screen;
// click the image (or the size button) to switch to its real pixel size, where
// it scrolls and drags. It closes with the Close button, Esc, a click outside the
// image, or the browser's Back button, and returns focus to the picture.

const dialog = document.createElement('dialog');
dialog.className = 'lightbox';
dialog.setAttribute('aria-label', 'Enlarged image');
dialog.innerHTML = `
  <div class="lb-bar">
    <p class="lb-hint" aria-live="polite"></p>
    <button type="button" class="lb-size" hidden>Real size</button>
    <button type="button" class="lb-close" autofocus><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" /></svg><span>Close</span></button>
  </div>
  <div class="lb-stage"><img class="lb-img" alt="" draggable="false" /></div>
  <p class="lb-credit"></p>`;
document.body.append(dialog);

const stage = dialog.querySelector<HTMLElement>('.lb-stage')!;
const img = dialog.querySelector<HTMLImageElement>('.lb-img')!;
const sizeBtn = dialog.querySelector<HTMLButtonElement>('.lb-size')!;
const closeBtn = dialog.querySelector<HTMLButtonElement>('.lb-close')!;
const credit = dialog.querySelector<HTMLElement>('.lb-credit')!;
const hint = dialog.querySelector<HTMLElement>('.lb-hint')!;
const touch = matchMedia('(hover: none)').matches;
let opener: HTMLElement | null = null;
let pushed = false;
let real = false;

/** The image can grow beyond its fitted size, so a real-size view is worth offering. */
const canGrow = () => img.naturalWidth > img.clientWidth + 8 || img.naturalHeight > img.clientHeight + 8;

/** Say what the reader can do right now, in words that fit how they are holding the screen. */
function updateHint() {
  hint.textContent = touch
    ? real ? 'Swipe to look around. Tap Close to go back.' : 'Tap outside the image, or Close, to go back.'
    : real ? 'Drag to look around. Click the image to fit it again. Esc closes.' : 'Click the image for its real size. Esc or a click outside closes.';
}

function setReal(on: boolean, fx = 0.5, fy = 0.5) {
  real = on;
  dialog.classList.toggle('real', on);
  sizeBtn.textContent = on ? 'Fit to screen' : 'Real size';
  updateHint();
  if (on) {
    // Keep the point that was clicked under the pointer's centre.
    stage.scrollLeft = fx * stage.scrollWidth - stage.clientWidth / 2;
    stage.scrollTop = fy * stage.scrollHeight - stage.clientHeight / 2;
  } else {
    stage.scrollTo(0, 0);
  }
}

/** On a phone a wide diagram fitted to the screen is too small to read, so start at real size. */
let firstLoad = false;
function refreshSizeButton() {
  if (firstLoad && touch && !real && img.naturalWidth > img.clientWidth * 1.8) setReal(true, 0, 0.5);
  firstLoad = false;
  sizeBtn.hidden = !real && !canGrow();
  img.style.cursor = real ? 'zoom-out' : canGrow() ? 'zoom-in' : 'default';
}

function open(link: HTMLAnchorElement) {
  opener = link;
  const thumb = link.querySelector('img');
  img.alt = thumb?.alt ?? '';
  img.src = link.href;
  const name = link.dataset.credit;
  credit.textContent = '';
  if (name) {
    credit.append('Image: ');
    const a = document.createElement('a');
    a.textContent = name;
    a.href = link.dataset.creditUrl ?? '#';
    a.target = '_blank';
    a.rel = 'noopener';
    credit.append(a);
  }
  setReal(false);
  sizeBtn.hidden = true;
  firstLoad = true;
  document.documentElement.classList.add('lb-open');
  dialog.showModal();
  // Back closes the viewer first, as people expect on a phone.
  history.pushState({ radarLightbox: true }, '');
  pushed = true;
  if (img.complete) refreshSizeButton();
}

/** Close from the viewer's own controls; the popstate handler does the rest. */
function requestClose() {
  if (pushed) history.back();
  else dialog.close();
}

dialog.addEventListener('close', () => {
  document.documentElement.classList.remove('lb-open');
  img.removeAttribute('src');
  opener?.focus({ preventScroll: true });
  opener = null;
});
window.addEventListener('popstate', () => {
  pushed = false;
  if (dialog.open) dialog.close();
});
// Esc closes the dialog natively; make sure the history entry goes with it.
dialog.addEventListener('cancel', (e) => {
  e.preventDefault();
  requestClose();
});

img.addEventListener('load', refreshSizeButton);
window.addEventListener('resize', () => { if (dialog.open) refreshSizeButton(); });

closeBtn.addEventListener('click', requestClose);
sizeBtn.addEventListener('click', () => setReal(!real));
img.addEventListener('click', (e) => {
  if (justDragged) return;
  if (real) return setReal(false);
  if (!canGrow()) return;
  const r = img.getBoundingClientRect();
  setReal(true, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
});
// A click on the dark area around the image closes the viewer.
stage.addEventListener('click', (e) => { if (e.target === stage) requestClose(); });

// Drag to pan at real size.
let drag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
img.addEventListener('pointerdown', (e) => {
  if (!real || e.pointerType === 'touch') return;
  drag = { x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop, moved: false };
  img.setPointerCapture(e.pointerId);
});
img.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  stage.scrollLeft = drag.left - dx;
  stage.scrollTop = drag.top - dy;
});
let justDragged = false;
img.addEventListener('pointerup', () => {
  justDragged = !!drag?.moved;
  drag = null;
  // The click that ends a drag must not toggle the size.
  if (justDragged) setTimeout(() => { justDragged = false; }, 0);
});

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = (e.target as Element).closest<HTMLAnchorElement>('a[data-zoom]');
  if (!link) return;
  e.preventDefault();
  open(link);
});
