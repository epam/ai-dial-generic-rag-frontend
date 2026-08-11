import type { Theme } from '@/types/theme';

/**
 * Applies an already-resolved theme (see {@link resolveTheme}): writes each color as a real CSS
 * custom property on `root`, and sets `data-theme` to the theme's id so `color-scheme` (in
 * globals.css) and other `[data-theme]` CSS can follow it. No-ops if `theme` is `null` (nothing
 * resolved) or if `root` isn't given and `document` isn't available (e.g. during SSR).
 */
export function applyTheme(theme: Theme | null, root?: HTMLElement): void {
  const target =
    root ??
    (typeof document === 'undefined' ? undefined : document.documentElement);
  if (!target || !theme) {
    return;
  }

  for (const [key, value] of Object.entries(theme.colors)) {
    target.style.setProperty(`--${key}`, value);
  }
  target.dataset.theme = theme.id;
}
