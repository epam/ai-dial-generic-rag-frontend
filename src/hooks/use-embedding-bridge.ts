'use client';

import { ChatVisualizerConnector } from '@epam/ai-dial-chat-visualizer-connector';
import { VisualizerConnectorEvents } from '@epam/ai-dial-shared';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEmbeddingContext } from '@/context/EmbeddingContext';
import { applyTheme } from '@/utils/embedding/apply-theme';
import { resolveParentOrigin } from '@/utils/embedding/resolve-parent-origin';
import { createLogger } from '@/utils/logger';

const DEFAULT_APP_NAME =
  process.env.NEXT_PUBLIC_DIAL_APPLICATION_NAME || 'Generic RAG';

const logger = createLogger('embedding');

/**
 * Bridges this app to DIAL Admin when embedded as an iframe: applies the `theme`/`authProvider`/
 * `id` query params, and sends the `ChatVisualizerConnector` ready handshake so DIAL Admin clears
 * its loading state. Auth is intentionally out of scope here.
 */
export function useEmbeddingBridge(): void {
  const searchParams = useSearchParams();
  const theme = searchParams.get('theme');
  const authProvider = searchParams.get('authProvider');
  const id = searchParams.get('id');
  const { setEmbeddingParams } = useEmbeddingContext();

  useEffect(() => {
    applyTheme(theme);
    setEmbeddingParams({ theme, authProvider, id });
    logger.info('applied embedding params', { theme, authProvider, id });
  }, [theme, authProvider, id, setEmbeddingParams]);

  useEffect(() => {
    // Debug-only visibility into every inbound postMessage, regardless of origin or
    // namespacing — the ChatVisualizerConnector below only reacts to messages matching
    // its own appName, so this is the only place we'd notice a host reply under a name
    // we didn't anticipate, or from an unexpected origin.
    const handleRawMessage = (event: MessageEvent) => {
      logger.debug('received raw postMessage', {
        origin: event.origin,
        data: event.data,
      });
    };
    window.addEventListener('message', handleRawMessage);

    return () => window.removeEventListener('message', handleRawMessage);
  }, []);

  useEffect(() => {
    const parentOrigin = resolveParentOrigin();
    if (!parentOrigin) {
      logger.warn(
        'no parent origin resolved, skipping visualizer connector setup',
      );
      return;
    }

    // DIAL Admin may namespace incoming messages by the app's `id`, or by its display
    // name (`dial:applicationTypeDisplayName`/`scheme.name`) — which one it expects isn't
    // knowable from here, so broadcast the ready handshake under every candidate name.
    const candidateNames = Array.from(
      new Set([id, DEFAULT_APP_NAME].filter((name): name is string => !!name)),
    );

    logger.info('connecting to parent', { parentOrigin, candidateNames });

    let connector: ChatVisualizerConnector;
    try {
      connector = new ChatVisualizerConnector(
        parentOrigin,
        candidateNames[0],
        (visualizerData) => {
          logger.info('received visualizer data from host', {
            visualizerData,
          });
        },
      );
      connector.sendReady();
      connector.sendReadyToInteract();

      for (const name of candidateNames.slice(1)) {
        window.parent.postMessage(
          { type: `${name}/${VisualizerConnectorEvents.ready}` },
          parentOrigin,
        );
        window.parent.postMessage(
          { type: `${name}/${VisualizerConnectorEvents.readyToInteract}` },
          parentOrigin,
        );
      }

      logger.info('sent ready handshake', { candidateNames });
    } catch (error) {
      logger.error('failed to set up visualizer connector', {
        parentOrigin,
        candidateNames,
        error,
      });
      return;
    }

    return () => connector.destroy();
  }, [id]);
}
