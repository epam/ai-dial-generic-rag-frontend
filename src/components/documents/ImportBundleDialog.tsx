'use client';

import { useState } from 'react';
import {
  ButtonVariant,
  DialButton,
  DialErrorText,
  DialFormPopup,
  PopupSize,
} from '@epam/ai-dial-ui-kit';

import { SingleFilePicker } from '@/components/documents/SingleFilePicker';
import type { Document } from '@/types/documents';
import { channelLogger } from '@/utils/channel/logger';

// Export names bundles `<display_name>.msgpack`, so the picker filters to that extension. It's a soft
// filter only — the channel validates the bundle and returns 422 for anything incompatible.
const BUNDLE_ACCEPT_TYPES = '.msgpack';

// The channel offers no dry-run/preview, so these are fixed advisories shown before the user commits,
// matching the tasks-doc's "import warnings (schema mismatch, dropped index data, overwrite)".
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
 * Two-step modal for importing a previously-exported document bundle: (1) pick the `.msgpack` bundle,
 * (2) review the import warnings and confirm. Posts multipart `attachment` to
 * `POST /api/documents/import`; surfaces the channel's `422` as an "invalid bundle" message.
 */
export function ImportBundleDialog({
  applicationId,
  onClose,
  onImported,
}: ImportBundleDialogProps) {
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (step === 'select') {
      if (file) {
        setStep('confirm');
      }
      return;
    }

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
        setError(
          response.status === 422
            ? 'This file is not a valid or compatible document bundle.'
            : 'Failed to import the bundle. Please try again.',
        );
        return;
      }
      onImported((await response.json()) as Document);
    } catch (reason: unknown) {
      channelLogger.warn('failed to import document bundle', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
      setError('Failed to import the bundle. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialFormPopup
      open
      header="Import document bundle"
      size={PopupSize.Md}
      submitLabel={step === 'select' ? 'Next' : 'Import'}
      onClose={onClose}
      onCancel={onClose}
      onSubmit={handleSubmit}
      isLoading={submitting}
      disableSubmitButton={!file}
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        {step === 'select' ? (
          <SingleFilePicker
            file={file}
            onFileChange={setFile}
            acceptTypes={BUNDLE_ACCEPT_TYPES}
            emptyTextFirstLine="Drag & drop a document bundle here"
            emptyTextSecondLine="or click to browse"
            emptyButtonLabel="Select bundle"
            fileFormatError="Only .msgpack bundle files are supported."
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-secondary text-sm">
                Importing{' '}
                <span className="text-primary font-medium">{file?.name}</span>
              </p>
              <DialButton
                variant={ButtonVariant.Neutral}
                label="Back"
                onClick={() => setStep('select')}
              />
            </div>
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
          </div>
        )}
        {error && <DialErrorText text={error} />}
      </div>
    </DialFormPopup>
  );
}
