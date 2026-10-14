import { defineConfig } from 'astro/config';

// Served as a GitHub Pages project site. The account's user site owns the
// toamig.com domain, so this repo appears at toamig.com/radar/ with no DNS of
// its own. To move it to its own domain, change `site`, drop `base`, and add a
// CNAME in public/.
export default defineConfig({
  site: 'https://toamig.com',
  base: '/radar',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'auto' },
});
