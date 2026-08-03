'use client';

import { useState } from 'react';
import {
  DialErrorText,
  DialFormItem,
  DialFormPopup,
  DialInput,
  DialLoadFileArea,
  DialSchemaRenderer,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import type { JsonSchema } from '@epam/ai-dial-ui-kit';

import type { Document } from '@/types/documents';
import type { DocumentMetadataSchema } from '@/types/metadata';
import { channelLogger } from '@/utils/channel/logger';

const PDF_MIME_TYPE = 'application/pdf';

interface AddDocumentDialogProps {
  applicationId: string;
  /** The channel metadata JSON Schema; when present its properties drive the metadata form. */
  schema: DocumentMetadataSchema | null;
  onClose: () => void;
  onUploaded: (document: Document) => void;
}

/**
 * Modal for uploading a new document to the channel: a PDF file, an optional destination folder,
 * and a schema-driven metadata form. Submits multipart `attachment` + `metadata` (JSON string) to
 * `POST /api/documents`, matching the channel upload contract.
 */
export function AddDocumentDialog({
  applicationId,
  schema,
  onClose,
  onUploaded,
}: AddDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState('');
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSchema = Boolean(
    schema?.properties && Object.keys(schema.properties).length > 0,
  );

  const handleSubmit = async () => {
    // The submit button is disabled without a file, but guard anyway before building the request.
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('attachment', file);
    // metadata is only ever populated by the schema form, so a non-empty check is sufficient.
    if (Object.keys(metadata).length > 0) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const params = new URLSearchParams({ applicationId });
    const trimmedFolder = folder.trim();
    if (trimmedFolder) {
      params.set('folder', trimmedFolder);
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents?${params.toString()}`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        setError('Failed to upload document. Please try again.');
        return;
      }
      onUploaded((await response.json()) as Document);
    } catch (reason: unknown) {
      channelLogger.warn('failed to upload document', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
      setError('Failed to upload document. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialFormPopup
      open
      header="Add document"
      size={PopupSize.Md}
      submitLabel="Add"
      onClose={onClose}
      onCancel={onClose}
      onSubmit={handleSubmit}
      isLoading={submitting}
      disableSubmitButton={!file}
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        {/* The drop zone is `h-full` internally and centers its content, so it needs a sized
            parent — a fixed height here gives the label breathing room top and bottom. */}
        <div className="h-32 shrink-0">
          <DialLoadFileArea
            acceptTypes={PDF_MIME_TYPE}
            maxFilesCount={1}
            files={file ? [file] : []}
            onChange={(files) => setFile(files[0] ?? null)}
            emptyTextFirstLine="Drag & drop your PDF here"
            emptyTextSecondLine="or click to browse"
            emptyButtonLabel="Select file"
            fileFormatError="Only PDF files are supported."
          />
        </div>
        <DialFormItem label="Folder">
          <DialInput
            placeholder="e.g. reports/2026"
            value={folder}
            onChange={(value) => setFolder(value ?? '')}
          />
        </DialFormItem>
        {hasSchema && (
          <section className="border-primary mt-1 flex flex-col gap-3 border-t pt-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-highlight text-sm font-semibold">Metadata</h3>
              <p className="text-secondary text-xs">
                Attributes stored with this document, from the channel schema.
              </p>
            </div>
            <DialSchemaRenderer
              // DocumentMetadataSchema is a JSON Schema shape, but the ui-kit's stricter
              // JsonSchemaDef rejects our index-signature model, hence the double cast.
              schema={schema as unknown as JsonSchema}
              onDefaultValues={setMetadata}
              onChange={setMetadata}
            />
          </section>
        )}
        {error && <DialErrorText text={error} />}
      </div>
    </DialFormPopup>
  );
}
