const STORAGE_PREFIX = 'dial:embedding:';

/** The DIAL Admin embedding query params (`theme`, `authProvider`, `id`) read on load. */
export interface EmbeddingParams {
  theme: string | null;
  authProvider: string | null;
  id: string | null;
}

/**
 * Persists the embedding params to sessionStorage for later use (e.g. by auth).
 * @param params - The embedding params read from the DIAL Admin iframe URL.
 */
export function storeEmbeddingParams(params: EmbeddingParams): void {
  if (typeof window === 'undefined') {
    return;
  }

  for (const [key, value] of Object.entries(params)) {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    if (value) {
      window.sessionStorage.setItem(storageKey, value);
    } else {
      window.sessionStorage.removeItem(storageKey);
    }
  }
}

/**
 * Reads a previously stored embedding param by key.
 * @param key - Which embedding param to read.
 * @returns The stored value, or `null` if not present.
 */
export function getStoredEmbeddingParam(
  key: keyof EmbeddingParams,
): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
}
