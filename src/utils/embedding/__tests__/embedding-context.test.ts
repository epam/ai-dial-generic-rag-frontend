import { afterEach, describe, expect, it } from 'vitest';
import {
  getStoredEmbeddingParam,
  storeEmbeddingParams,
} from '@/utils/embedding/embedding-context';

describe('embedding-context', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('stores each param under its own namespaced key', () => {
    storeEmbeddingParams({
      theme: 'dark',
      authProvider: 'keycloak',
      id: 'demo-app',
    });

    expect(getStoredEmbeddingParam('theme')).toBe('dark');
    expect(getStoredEmbeddingParam('authProvider')).toBe('keycloak');
    expect(getStoredEmbeddingParam('id')).toBe('demo-app');
  });

  it('removes the stored value when a param is falsy', () => {
    storeEmbeddingParams({ theme: 'dark', authProvider: null, id: null });
    expect(getStoredEmbeddingParam('theme')).toBe('dark');

    storeEmbeddingParams({ theme: null, authProvider: null, id: null });
    expect(getStoredEmbeddingParam('theme')).toBeNull();
  });

  it('returns null for a param that was never stored', () => {
    expect(getStoredEmbeddingParam('id')).toBeNull();
  });
});
