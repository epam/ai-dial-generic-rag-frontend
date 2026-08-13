'use client';

import { useState } from 'react';
import {
  DialErrorText,
  DialFormPopup,
  DialSchemaRenderer,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import type { JsonSchema } from '@epam/ai-dial-ui-kit';

import { renderDateField } from '@/components/documents/render-date-field';
import { SingleFilePicker } from '@/components/documents/SingleFilePicker';
import type { Document } from '@/types/documents';
import type { DocumentMetadataSchema } from '@/types/metadata';
import { channelLogger } from '@/utils/channel/logger';

const PDF_MIME_TYPE = 'application/pdf';

interface EditDocumentDialogProps {
  applicationId: string;
  document: Document;
  /** The channel metadata JSON Schema; when present its properties drive the metadata form. */
  schema: DocumentMetadataSchema | null;
  onClose: () => void;
  onEdited: (document: Document) => void;
}

/**
 * Modal for editing an existing document: replace its file (optional) and/or edit its metadata
 * (pre-filled from the current values). Submits multipart `attachment`/`metadata` to
 * `PUT /api/documents/{id}`, matching the channel's update contract where both parts are optional.
 */
export function EditDocumentDialog({
  applicationId,
  document,
  schema,
  onClose,
  onEdited,
}: EditDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<Record<string, unknown>>(
    document.metadata ?? {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSchema = Boolean(
    schema?.properties && Object.keys(schema.properties).length > 0,
  );

  const handleSubmit = async () => {
    const formData = new FormData();
    if (file) {
      formData.append('attachment', file);
    }
    if (hasSchema) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const params = new URLSearchParams({ applicationId });
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/documents/${document.id}?${params.toString()}`,
        { method: 'PUT', body: formData },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? 'Failed to save changes. Please try again.');
        return;
      }
      onEdited((await response.json()) as Document);
    } catch (reason: unknown) {
      channelLogger.warn('failed to update document', {
        id: document.id,
        reason: reason instanceof Error ? reason.message : String(reason),
      });
      setError('Failed to save changes. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialFormPopup
      open
      header={`Edit "${document.display_name}"`}
      size={PopupSize.Md}
      submitLabel="Save"
      onClose={onClose}
      onCancel={onClose}
      onSubmit={handleSubmit}
      isLoading={submitting}
      disableSubmitButton={!file && !hasSchema}
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        <div className="flex flex-col gap-1">
          <span className="text-secondary text-xs">
            Optional: pick a file to replace the current content. Leave empty to
            keep it.
          </span>
          <SingleFilePicker
            file={file}
            onFileChange={setFile}
            acceptTypes={PDF_MIME_TYPE}
            emptyTextFirstLine="Drag & drop a replacement PDF here"
            emptyTextSecondLine="or click to browse"
            emptyButtonLabel="Replace file"
            fileFormatError="Only PDF files are supported."
          />
        </div>
        {hasSchema && (
          <section className="border-primary mt-1 flex flex-col gap-3 border-t pt-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-primary text-sm font-semibold">Metadata</h3>
              <p className="text-secondary text-xs">
                Attributes stored with this document, from the channel schema.
              </p>
            </div>
            <DialSchemaRenderer
              // DocumentMetadataSchema is a JSON Schema shape, but the ui-kit's stricter
              // JsonSchemaDef rejects our index-signature model, hence the double cast.
              schema={schema as unknown as JsonSchema}
              defaultValue={metadata}
              onChange={setMetadata}
              renderField={renderDateField}
            />
          </section>
        )}
        {error && <DialErrorText text={error} />}
      </div>
    </DialFormPopup>
  );
}
