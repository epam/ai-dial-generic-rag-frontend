import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getThemes } from '@/utils/themes/themes-api';

describe('getThemes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns null when THEMES_CONFIG_URL is not configured', async () => {
    vi.stubEnv('THEMES_CONFIG_URL', '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await getThemes()).toBeNull();
  });

  describe('with THEMES_CONFIG_URL configured', () => {
    beforeEach(() => {
      vi.stubEnv('THEMES_CONFIG_URL', 'https://themes.example.com');
      vi.stubGlobal('fetch', vi.fn());
    });

    it('fetches config.json and returns the themes array', async () => {
      const themes = [
        { id: 'dark', displayName: 'Dark', colors: { 'bg-layer-0': '#000' } },
      ];
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ themes }),
      });

      const result = await getThemes();

      expect(fetch).toHaveBeenCalledWith(
        'https://themes.example.com/config.json',
      );
      expect(result).toEqual(themes);
    });

    it('returns null when the fetch rejects', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('network down'),
      );

      expect(await getThemes()).toBeNull();
    });

    it('returns null on a non-OK response', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
      });

      expect(await getThemes()).toBeNull();
    });

    it('returns null when the response body is not valid JSON', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      });

      expect(await getThemes()).toBeNull();
    });

    it('returns null when the response shape is unexpected', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ notThemes: [] }),
      });

      expect(await getThemes()).toBeNull();
    });
  });
});
