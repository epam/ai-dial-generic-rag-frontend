/**
 * Applies the DIAL Admin `theme` query param as a `data-theme` attribute on `<html>`.
 * @param theme - The `theme` query param value, or `null` if absent.
 */
export function applyTheme(theme: string | null): void {
  if (!theme || typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = theme;
}
