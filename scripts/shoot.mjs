#!/usr/bin/env node
// Screenshots the built site so the daily run (or a person) can look at it
// before publishing. Serves dist/ with `astro preview`, then captures the
// newest issue on desktop, phone and dark mode, cut into slices short enough
// to read. Output: .cache/shots/<name>-<n>.png
//
//   node scripts/shoot.mjs            newest issue
//   node scripts/shoot.mjs 2026-10-14 a given day
//   node scripts/shoot.mjs week/2026-W42
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import puppeteer from 'puppeteer';

const PORT = 4331;
const target = process.argv[2] ?? '';
const out = '.cache/shots';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['astro', 'preview', '--port', String(PORT)], {
  stdio: 'ignore',
  shell: process.platform === 'win32',
});
const url = `http://localhost:${PORT}/radar/${target ? `${target}/` : ''}`;

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`preview server did not answer at ${url}`);
}

const VIEWS = [
  { name: 'desktop', width: 1440, height: 1000, dark: false, slice: 1400 },
  { name: 'phone', width: 390, height: 844, dark: false, slice: 1600, mobile: true },
  { name: 'dark', width: 1440, height: 1000, dark: true, slice: 1400, max: 2 },
];

try {
  await waitForServer();
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const files = [];
  for (const v of VIEWS) {
    const page = await browser.newPage();
    await page.setViewport({ width: v.width, height: v.height, deviceScaleFactor: 1, isMobile: !!v.mobile, hasTouch: !!v.mobile });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: v.dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(url, { waitUntil: 'networkidle0' });
    // Show charts in their drawn state, and load lazy images: a full-page
    // capture never scrolls, so they would otherwise stay blank.
    await page.evaluate(async () => {
      document.querySelectorAll('.chart').forEach((c) => c.classList.add('in'));
      const imgs = [...document.images];
      imgs.forEach((img) => { img.loading = 'eager'; });
      await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 8000); }))));
    });
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) console.log(`warn  ${v.name}: page scrolls sideways`);
    const count = Math.min(Math.ceil(height / v.slice), v.max ?? 12);
    for (let i = 0; i < count; i++) {
      const file = `${out}/${v.name}-${i + 1}.png`;
      await page.screenshot({ path: file, clip: { x: 0, y: i * v.slice, width: v.width, height: Math.min(v.slice, height - i * v.slice) }, captureBeyondViewport: true });
      files.push(file);
    }
    await page.close();
  }
  await browser.close();
  console.log(files.join('\n'));
} finally {
  server.kill();
}
