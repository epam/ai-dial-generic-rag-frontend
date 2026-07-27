import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

  it('exposes dialAdminUrl/applicationName from provider props, defaulting when unset', () => {
    const withProps = renderHook(() => useEmbeddingContext(), {
      wrapper: ({ children }) => (
        <EmbeddingContextProvider
          dialAdminUrl="https://admin.example.com"
          applicationName="My App"
        >
          {children}
        </EmbeddingContextProvider>
      ),
    });
    expect(withProps.result.current.dialAdminUrl).toBe(
      'https://admin.example.com',
    );
    expect(withProps.result.current.applicationName).toBe('My App');

    const withoutProps = renderHook(() => useEmbeddingContext(), {
      wrapper: EmbeddingContextProvider,
    });
    expect(withoutProps.result.current.dialAdminUrl).toBeNull();
    expect(withoutProps.result.current.applicationName).toBe('Generic RAG');
  });

  it('reportDirtyState is a no-op until a sender is registered', () => {
    const { result } = renderHook(() => useEmbeddingContext(), {
      wrapper: EmbeddingContextProvider,
    });

    expect(() => result.current.reportDirtyState(true)).not.toThrow();
  });

  it('reportDirtyState forwards to the registered sender', () => {
    const { result } = renderHook(() => useEmbeddingContext(), {
      wrapper: EmbeddingContextProvider,
    });
    const sender = vi.fn();

    act(() => {
      result.current.registerDirtyStateSender(sender);
      result.current.reportDirtyState(true);
    });

    expect(sender).toHaveBeenCalledWith(true);
  });

  it('notifySaveRequested calls all subscribed listeners, and unsubscribe stops future calls', () => {
    const { result } = renderHook(() => useEmbeddingContext(), {
      wrapper: EmbeddingContextProvider,
    });
    const listener = vi.fn();

    let unsubscribe: () => void = () => {};
    act(() => {
      unsubscribe = result.current.onSaveRequested(listener);
      result.current.notifySaveRequested();
    });
    expect(listener).toHaveBeenCalledTimes(1);

    act(() => {
      unsubscribe();
      result.current.notifySaveRequested();
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
