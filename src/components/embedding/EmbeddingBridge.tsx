'use client';

import { useEmbeddingBridge } from '@/hooks/use-embedding-bridge';

/**
 * Renders nothing itself; requires an ancestor `Suspense` boundary for `useEmbeddingBridge`'s
 * `useSearchParams` usage — provided in the root layout.
 */
export function EmbeddingBridge() {
  useEmbeddingBridge();
  return null;
}
