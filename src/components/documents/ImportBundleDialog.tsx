'use client';

import { useState } from 'react';
import { DialFormPopup, PopupSize } from '@epam/ai-dial-ui-kit';

import { SingleFilePicker } from '@/components/documents/SingleFilePicker';
import type { Document } from '@/types/documents';
import { channelLogger } from '@/utils/channel/logger';

// Export names bundles `<display_name>.msgpack`, so the picker filters to that extension. It's a soft
// filter only — the channel validates the bundle and returns 422 for anything incompatible.
const BUNDLE_ACCEPT_TYPES = '.msgpack';

// The channel offers no dry-run/preview, so these are fixed advisories shown up front (before the
// file is even chosen), matching the tasks-doc's "import warnings (schema mismatch, dropped index
// data, overwrite)".
const IMPORT_WARNINGS = [
  "The bundle's metadata may not match this channel's current schema.",
  'Index data in the bundle can be dropped if it is incompatible.',
  'An existing document with the same identity may be overwritten.',
];

interface ImportBundleDialogProps {
  applicationId: string;
  onClose: () => void;
  onImported: (document: Document) => void;
}

/**
 * Modal for importing a previously-exported document bundle. The import warnings are shown up front
 * alongside the file picker (the channel has no dry-run/preview to drive a real preview step), so
 * the user reads them, picks the `.msgpack` bundle, and imports in one step. Posts multipart
 * `attachment` to `POST /api/documents/import` and, on failure, shows the channel's own error message
 * (with a generic fallback for a 500 or a bodyless response).
 */
export function ImportBundleDialog({
  applicationId,
  onClose,
  onImported,
}: ImportBundleDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // `text` is the concise one-line message shown in the block; `full` (when present) is the verbose
  // diagnostic revealed on hover.
  const [error, setError] = useState<{ text: string; full?: string } | null>(
    null,
  );

  const handleSubmit = async () => {
    // The submit button is disabled without a file, but guard anyway before building the request.
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('attachment', file);
    const params = new URLSearchParams({ applicationId });

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/documents/import?${params.toString()}`,
        { method: 'POST', body: formData },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          errorDetail?: string;
        } | null;
        setError({
          text: body?.error ?? 'Failed to import the bundle. Please try again.',
          full: body?.errorDetail,
        });
        return;
      }
      onImported((await response.json()) as Document);
    } catch (reason: unknown) {
      channelLogger.warn('failed to import document bundle', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
      setError({ text: 'Failed to import the bundle. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialFormPopup
      open
      header="Import document bundle"
      size={PopupSize.Md}
      submitLabel="Import"
      onClose={onClose}
      onCancel={onClose}
      onSubmit={handleSubmit}
      isLoading={submitting}
      disableSubmitButton={!file}
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        <section className="border-primary flex flex-col gap-2 rounded border p-3">
          <h3 className="text-primary text-sm font-semibold">
            Before you import
          </h3>
          <ul className="text-secondary flex list-disc flex-col gap-1 pl-5 text-xs">
            {IMPORT_WARNINGS.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
        <SingleFilePicker
          file={file}
          onFileChange={setFile}
          acceptTypes={BUNDLE_ACCEPT_TYPES}
          emptyTextFirstLine="Drag & drop a document bundle here"
          emptyTextSecondLine="or click to browse"
          emptyButtonLabel="Select bundle"
          fileFormatError="Only .msgpack bundle files are supported."
        />
        {error && (
          <p
            role="alert"
            className="text-error truncate text-xs"
            title={error.full ?? error.text}
          >
            {error.text}
          </p>
        )}
      </div>
    </DialFormPopup>
  );
}
