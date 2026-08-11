import type { Theme } from '@/types/theme';
import { themesLogger } from '@/utils/themes/logger';

interface ThemesConfigResponse {
  themes: Theme[];
}

function isThemesConfigResponse(value: unknown): value is ThemesConfigResponse {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as ThemesConfigResponse).themes)
  );
}

/**
 * Fetches the DIAL themes config service's theme list. Resolves `null` on any failure (unset
 * `THEMES_CONFIG_URL`, network error, non-OK response, malformed JSON, or unexpected shape) —
 * theming degrades gracefully to whatever's baked into the CSS rather than throwing.
 */
export async function getThemes(): Promise<Theme[] | null> {
  const baseUrl = process.env.THEMES_CONFIG_URL;
  if (!baseUrl) {
    themesLogger.warn(
      'THEMES_CONFIG_URL is not configured, skipping themes fetch',
    );
    return null;
  }

  const url = `${baseUrl}/config.json`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    themesLogger.error('failed to reach themes config service', {
      url,
      error,
    });
    return null;
  }

  if (!response.ok) {
    themesLogger.warn('themes config service responded with a non-OK status', {
      url,
      status: response.status,
    });
    return null;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    themesLogger.error('themes config response is not valid JSON', {
      url,
      error,
    });
    return null;
  }

  if (!isThemesConfigResponse(body)) {
    themesLogger.error('themes config response has an unexpected shape', {
      url,
      body,
    });
    return null;
  }

  return body.themes;
}
