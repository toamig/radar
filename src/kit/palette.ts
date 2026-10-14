import { resolveTheme } from './catalog.mjs';
export type Palette = { a: string; b: string; plate: string };
export function palette(theme: Record<string, unknown>): Palette {
  const t = resolveTheme(theme);
  return { a: t.day.inkA, b: t.day.inkB, plate: t.plate };
}
