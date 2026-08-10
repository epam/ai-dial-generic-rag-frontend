import { describe, expect, it } from 'vitest';

import { resolveTheme } from '@/utils/themes/resolve-theme';
import type { Theme } from '@/types/theme';

const themes: Theme[] = [
  { id: 'dark', displayName: 'Dark', colors: {} },
  { id: 'light', displayName: 'Light', colors: {} },
];

describe('resolveTheme', () => {
  it('returns the exact id match', () => {
    expect(resolveTheme(themes, 'light')).toBe(themes[1]);
  });

  it('falls back to the first theme when the id has no match', () => {
    expect(resolveTheme(themes, 'unknown-id')).toBe(themes[0]);
  });

  it('falls back to the first theme when the id is null', () => {
    expect(resolveTheme(themes, null)).toBe(themes[0]);
  });

  it('returns null when themes is null', () => {
    expect(resolveTheme(null, 'dark')).toBeNull();
  });

  it('returns null when themes is empty', () => {
    expect(resolveTheme([], 'dark')).toBeNull();
  });
});
