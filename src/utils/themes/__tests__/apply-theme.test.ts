import { afterEach, describe, expect, it } from 'vitest';

import { applyTheme } from '@/utils/themes/apply-theme';
import type { Theme } from '@/types/theme';

const darkTheme: Theme = {
  id: 'dark',
  displayName: 'Dark',
  colors: { 'bg-layer-0': '#000000' },
};

describe('applyTheme', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    document.documentElement.style.removeProperty('--bg-layer-0');
  });

  it('sets the theme colors as CSS custom properties and data-theme', () => {
    applyTheme(darkTheme);

    expect(
      document.documentElement.style.getPropertyValue('--bg-layer-0'),
    ).toBe('#000000');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('does nothing when theme is null', () => {
    applyTheme(null);

    expect(
      document.documentElement.style.getPropertyValue('--bg-layer-0'),
    ).toBe('');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('applies to a given root element instead of document.documentElement', () => {
    const root = document.createElement('html');

    applyTheme(darkTheme, root);

    expect(root.style.getPropertyValue('--bg-layer-0')).toBe('#000000');
    expect(root.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
