import type { Theme } from '@/types/theme';

/**
 * Resolves the theme to use: an exact `id` match, falling back to the first theme in the config
 * when the current theme id doesn't match any (or is absent), falling back to `null` when there's
 * no config at all.
 */
export function resolveTheme(
  themes: Theme[] | null,
  currentThemeId: string | null,
): Theme | null {
  return themes?.find((t) => t.id === currentThemeId) ?? themes?.[0] ?? null;
}
