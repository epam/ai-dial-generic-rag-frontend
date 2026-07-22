import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme } from '@/utils/embedding/apply-theme';

describe('applyTheme', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it('sets data-theme on <html> when a theme is given', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('does nothing when theme is null', () => {
    applyTheme(null);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
