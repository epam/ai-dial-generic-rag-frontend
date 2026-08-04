'use client';

import { useState } from 'react';
import {
  ConfirmationPopupVariant,
  DialConfirmationPopup,
  DialErrorText,
} from '@epam/ai-dial-ui-kit';

import type { Document } from '@/types/documents';
import { channelLogger } from '@/utils/channel/logger';

interface DeleteDocumentDialogProps {
  applicationId: string;
  document: Document;
  onClose: () => void;
  onDeleted: () => void;
}

/** Confirms and deletes a document via `DELETE /api/documents/{id}`. */
export function DeleteDocumentDialog({
  applicationId,
  document,
  onClose,
  onDeleted,
}: DeleteDocumentDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    const params = new URLSearchParams({ applicationId });
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/documents/${document.id}?${params.toString()}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        setError('Failed to delete document. Please try again.');
        return;
      }
      onDeleted();
    } catch (reason: unknown) {
      channelLogger.warn('failed to delete document', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
      setError('Failed to delete document. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DialConfirmationPopup
      open
      variant={ConfirmationPopupVariant.Danger}
      header="Delete document"
      confirmLabel="Delete"
      onConfirm={handleConfirm}
      onCancel={onClose}
      onClose={onClose}
      isLoading={deleting}
    >
      <div className="flex flex-col gap-2 px-6 py-4">
        <p className="text-secondary text-sm">
          Delete{' '}
          <span className="text-highlight font-medium">
            {document.display_name}
          </span>
          ? This cannot be undone.
        </p>
        {error && <DialErrorText text={error} />}
      </div>
    </DialConfirmationPopup>
  );
}
