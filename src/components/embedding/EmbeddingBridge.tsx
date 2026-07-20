'use client';

import { useEmbeddingBridge } from '@/hooks/use-embedding-bridge';

/**
 * Hosts the `Suspense` boundary `useEmbeddingBridge` requires (via `useSearchParams`) and
 * renders nothing itself.
 */
export function EmbeddingBridge() {
  useEmbeddingBridge();
  return null;
}
