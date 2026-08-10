import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let mockThemeParam: string | null = null;
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'theme' ? mockThemeParam : null),
  }),
}));

import { ThemeContextProvider, useThemeContext } from '@/context/ThemeContext';
import type { Theme } from '@/types/theme';

const themes: Theme[] = [
  { id: 'dark', displayName: 'Dark', colors: { 'bg-layer-0': '#000000' } },
  { id: 'light', displayName: 'Light', colors: { 'bg-layer-0': '#ffffff' } },
];

describe('ThemeContext', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    document.documentElement.style.removeProperty('--bg-layer-0');
  });

  it('applies the resolved theme to document.documentElement as a side effect', () => {
    mockThemeParam = 'light';

    renderHook(() => useThemeContext(), {
      wrapper: ({ children }) => (
        <ThemeContextProvider themes={themes}>{children}</ThemeContextProvider>
      ),
    });

    expect(
      document.documentElement.style.getPropertyValue('--bg-layer-0'),
    ).toBe('#ffffff');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('resolves the theme from the query param synchronously, no lag', () => {
    mockThemeParam = 'light';

    const { result } = renderHook(() => useThemeContext(), {
      wrapper: ({ children }) => (
        <ThemeContextProvider themes={themes}>{children}</ThemeContextProvider>
      ),
    });

    expect(result.current.resolvedTheme).toEqual(themes[1]);
    expect(result.current.isDarkTheme).toBe(false);
  });

  it('treats a non-light theme id as dark', () => {
    mockThemeParam = 'dark';

    const { result } = renderHook(() => useThemeContext(), {
      wrapper: ({ children }) => (
        <ThemeContextProvider themes={themes}>{children}</ThemeContextProvider>
      ),
    });

    expect(result.current.isDarkTheme).toBe(true);
  });

  it('defaults to dark when no theme param and no themes config', () => {
    mockThemeParam = null;

    const { result } = renderHook(() => useThemeContext(), {
      wrapper: ({ children }) => (
        <ThemeContextProvider themes={null}>{children}</ThemeContextProvider>
      ),
    });

    expect(result.current.resolvedTheme).toBeNull();
    expect(result.current.isDarkTheme).toBe(true);
  });

  it('returns defaults when used outside a provider', () => {
    const { result } = renderHook(() => useThemeContext());

    expect(result.current.themes).toBeNull();
    expect(result.current.resolvedTheme).toBeNull();
    expect(result.current.isDarkTheme).toBe(true);
  });
});
