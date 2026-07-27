'use client';

import { createContext, useContext, useMemo, useRef, useState } from 'react';

/** The DIAL Admin embedding query params (`theme`, `authProvider`, `id`) read on load. */
export interface EmbeddingParams {
  theme: string | null;
  authProvider: string | null;
  id: string | null;
}

/** Static embedding config, read server-side from env vars and passed down at the root. */
export interface EmbeddingConfig {
  dialAdminUrl: string | null;
  applicationName: string;
}

type SaveRequestedListener = () => void;

interface EmbeddingContextValue extends EmbeddingParams, EmbeddingConfig {
  setEmbeddingParams: (params: EmbeddingParams) => void;
  /** Broadcasts unsaved-changes state to DIAL Admin, once the connector is ready. No-op until then. */
  reportDirtyState: (isChanged: boolean) => void;
  /** Registers a listener for DIAL Admin's `{ saveChanges: true }` request. Returns an unsubscribe function. */
  onSaveRequested: (listener: SaveRequestedListener) => () => void;
  /** Used by `useEmbeddingBridge` to wire `reportDirtyState` to the live connector, once ready. */
  registerDirtyStateSender: (
    sender: ((isChanged: boolean) => void) | null,
  ) => void;
  /** Used by `useEmbeddingBridge` to notify subscribers when DIAL Admin requests a save. */
  notifySaveRequested: () => void;
}

const defaultParams: EmbeddingParams = {
  theme: null,
  authProvider: null,
  id: null,
};

const defaultConfig: EmbeddingConfig = {
  dialAdminUrl: null,
  applicationName: 'Generic RAG',
};

const EmbeddingContext = createContext<EmbeddingContextValue>({
  ...defaultParams,
  ...defaultConfig,
  setEmbeddingParams: () => {},
  reportDirtyState: () => {},
  onSaveRequested: () => () => {},
  registerDirtyStateSender: () => {},
  notifySaveRequested: () => {},
});

/**
 * Holds the DIAL Admin embedding params/config for the lifetime of the app, so the dynamic
 * params survive client-side navigation even after the query string that carried them is gone.
 * `dialAdminUrl`/`applicationName` come from server-read env vars, passed down as props from the
 * root layout rather than read as `NEXT_PUBLIC_*` build-time constants.
 */
export function EmbeddingContextProvider({
  children,
  dialAdminUrl = defaultConfig.dialAdminUrl,
  applicationName = defaultConfig.applicationName,
}: {
  children: React.ReactNode;
  dialAdminUrl?: string | null;
  applicationName?: string;
}) {
  const [params, setEmbeddingParams] = useState<EmbeddingParams>(defaultParams);
  const dirtyStateSender = useRef<((isChanged: boolean) => void) | null>(null);
  const saveRequestedListeners = useRef<Set<SaveRequestedListener>>(new Set());

  const value = useMemo<EmbeddingContextValue>(
    () => ({
      ...params,
      dialAdminUrl,
      applicationName,
      setEmbeddingParams,
      reportDirtyState: (isChanged: boolean) => {
        dirtyStateSender.current?.(isChanged);
      },
      onSaveRequested: (listener: SaveRequestedListener) => {
        saveRequestedListeners.current.add(listener);
        return () => saveRequestedListeners.current.delete(listener);
      },
      registerDirtyStateSender: (sender) => {
        dirtyStateSender.current = sender;
      },
      notifySaveRequested: () => {
        for (const listener of saveRequestedListeners.current) {
          listener();
        }
      },
    }),
    [params, dialAdminUrl, applicationName],
  );

  return (
    <EmbeddingContext.Provider value={value}>
      {children}
    </EmbeddingContext.Provider>
  );
}

/** Reads the current DIAL Admin embedding params/config. */
export function useEmbeddingContext(): EmbeddingContextValue {
  return useContext(EmbeddingContext);
}
