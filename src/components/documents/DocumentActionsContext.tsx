'use client';

import { createContext, useContext } from 'react';

import type { Document } from '@/types/documents';

/** Row-action handlers provided by DocumentsGrid and consumed by each row's actions cell. */
export interface DocumentActions {
  onDownload: (document: Document) => void;
  onReindex: (document: Document) => void;
  onRequestDelete: (document: Document) => void;
}

const DocumentActionsContext = createContext<DocumentActions | null>(null);

export const DocumentActionsProvider = DocumentActionsContext.Provider;

/** Reads the row-action handlers; throws if rendered outside a {@link DocumentActionsProvider}. */
export function useDocumentActions(): DocumentActions {
  const actions = useContext(DocumentActionsContext);
  if (!actions) {
    throw new Error(
      'useDocumentActions must be used within a DocumentActionsProvider',
    );
  }
  return actions;
}
