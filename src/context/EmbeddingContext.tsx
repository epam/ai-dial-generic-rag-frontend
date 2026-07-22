'use client';

import { createContext, useContext, useMemo, useState } from 'react';

/** The DIAL Admin embedding query params (`theme`, `authProvider`, `id`) read on load. */
export interface EmbeddingParams {
  theme: string | null;
  authProvider: string | null;
  id: string | null;
}

interface EmbeddingContextValue extends EmbeddingParams {
  setEmbeddingParams: (params: EmbeddingParams) => void;
}

const defaultParams: EmbeddingParams = {
  theme: null,
  authProvider: null,
  id: null,
};

const EmbeddingContext = createContext<EmbeddingContextValue>({
  ...defaultParams,
  setEmbeddingParams: () => {},
});

/**
 * Holds the DIAL Admin embedding params for the lifetime of the app, so they survive
 * client-side navigation even after the query string that carried them is gone.
 */
export function EmbeddingContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [params, setEmbeddingParams] = useState<EmbeddingParams>(defaultParams);

  const value = useMemo(() => ({ ...params, setEmbeddingParams }), [params]);

  return (
    <EmbeddingContext.Provider value={value}>
      {children}
    </EmbeddingContext.Provider>
  );
}

/** Reads the current DIAL Admin embedding params (`theme`/`authProvider`/`id`). */
export function useEmbeddingContext(): EmbeddingContextValue {
  return useContext(EmbeddingContext);
}
