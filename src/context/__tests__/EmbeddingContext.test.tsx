import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  EmbeddingContextProvider,
  useEmbeddingContext,
} from '@/context/EmbeddingContext';

describe('EmbeddingContext', () => {
  it('defaults to null params before anything is set', () => {
    const { result } = renderHook(() => useEmbeddingContext(), {
      wrapper: EmbeddingContextProvider,
    });

    expect(result.current.theme).toBeNull();
    expect(result.current.authProvider).toBeNull();
    expect(result.current.id).toBeNull();
  });

  it('exposes the params set via setEmbeddingParams to all consumers', () => {
    const { result } = renderHook(() => useEmbeddingContext(), {
      wrapper: EmbeddingContextProvider,
    });

    act(() => {
      result.current.setEmbeddingParams({
        theme: 'dark',
        authProvider: 'keycloak',
        id: 'demo-app',
      });
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.authProvider).toBe('keycloak');
    expect(result.current.id).toBe('demo-app');
  });

  it('returns defaults when used outside a provider', () => {
    const { result } = renderHook(() => useEmbeddingContext());

    expect(result.current.theme).toBeNull();
    expect(result.current.authProvider).toBeNull();
    expect(result.current.id).toBeNull();
  });
});
