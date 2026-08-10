'use client';

import { createContext, useContext, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Theme } from '@/types/theme';
import { applyTheme } from '@/utils/themes/apply-theme';
import { resolveTheme } from '@/utils/themes/resolve-theme';

interface ThemeContextValue {
  themes: Theme[] | null;
  resolvedTheme: Theme | null;
  /** `true` unless the resolved theme's id is literally `'light'` — matches the `color-scheme` convention in globals.css. */
  isDarkTheme: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  themes: null,
  resolvedTheme: null,
  isDarkTheme: true,
});

/**
 * Holds the themes config fetched server-side, resolves the theme for the current `theme` query
 * param, and applies it (writing its colors as real CSS custom properties) synchronously in the
 * render body — before children render, so there's no flash of the wrong theme. Exposes the
 * resolved theme and a derived `isDarkTheme` so consumers outside CSS (e.g. the ag-grid theme)
 * don't re-derive the id check or re-resolve the theme themselves. Reads the query param directly
 * via `useSearchParams` rather than `EmbeddingContext`'s state, which only settles one effect
 * after mount — that lag would otherwise show as a one-frame flash of the wrong grid color scheme.
 */
export function ThemeContextProvider({
  children,
  themes,
}: {
  children: React.ReactNode;
  themes: Theme[] | null;
}) {
  const theme = useSearchParams().get('theme');
  const resolvedTheme = resolveTheme(themes, theme);
  applyTheme(resolvedTheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themes,
      resolvedTheme,
      isDarkTheme: resolvedTheme?.id !== 'light',
    }),
    [themes, resolvedTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Reads the resolved theme / `isDarkTheme` derived from the current embedding theme id. */
export function useThemeContext(): ThemeContextValue {
  return useContext(ThemeContext);
}
