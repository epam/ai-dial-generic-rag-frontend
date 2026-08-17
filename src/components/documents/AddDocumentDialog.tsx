'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DialCheckbox,
  DialErrorText,
  DialFormItem,
  DialFormPopup,
  DialInput,
  DialSchemaRenderer,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import type { JsonSchema } from '@epam/ai-dial-ui-kit';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconLoader2,
} from '@tabler/icons-react';

import { renderDateField } from '@/components/documents/render-date-field';
import { SingleFilePicker } from '@/components/documents/SingleFilePicker';
import type { Document } from '@/types/documents';
import type { DocumentMetadataSchema } from '@/types/metadata';
import { channelLogger } from '@/utils/channel/logger';

const PDF_MIME_TYPE = 'application/pdf';

// The file path is `folder` + the picked file's name. A discrete file pick is checked immediately;
// folder edits are debounced (like a username-availability field) so we check on a typing pause,
// not per keystroke.
const FOLDER_CHECK_DEBOUNCE_MS = 3000;

/**
 * Live result of validating the upload path against the channel:
 * `idle` (nothing to show) · `checking` (request pending) · `available` (free) · `taken` (a
 * document already lives at this filename + folder).
 */
type PathStatus = 'idle' | 'checking' | 'available' | 'taken';

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
 *
 * As the user picks a file / edits the folder it live-checks the resulting path against
 * `GET /api/documents/exists` and shows availability inline — immediately on a file pick, debounced
 * on folder edits. A taken path blocks Add (upload would overwrite); the check is best-effort, so a
 * failed check never blocks the upload.
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
  const [pathStatus, setPathStatus] = useState<PathStatus>('idle');
  // When on, the channel is told to replace any document at the same path (`overwrite=true`), so the
  // existence check is skipped and a taken path no longer blocks Add.
  const [overwrite, setOverwrite] = useState(false);

  const pathTaken = !overwrite && pathStatus === 'taken';
  const trimmedFolder = folder.trim();

  // The in-flight existence check's controller and the pending folder-debounce timer, so a newer
  // trigger (or unmount) supersedes the previous one.
  const checkAbortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasSchema = Boolean(
    schema?.properties && Object.keys(schema.properties).length > 0,
  );

  // Runs a single existence check for the given path, superseding any prior in-flight one. Kept in a
  // callback (not an effect) so the file pick can fire it immediately while a folder edit debounces.
  const runPathCheck = useCallback(
    (checkFile: File, checkFolder: string) => {
      checkAbortRef.current?.abort();
      const controller = new AbortController();
      checkAbortRef.current = controller;

      setPathStatus('checking');

      const params = new URLSearchParams({
        applicationId,
        filename: checkFile.name,
      });
      if (checkFolder) {
        params.set('folder', checkFolder);
      }

      fetch(`/api/documents/exists?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (controller.signal.aborted) {
            return;
          }
          if (!response.ok) {
            // Best-effort: a failed check must not block the upload.
            setPathStatus('idle');
            return;
          }
          const body = (await response.json()) as { exists?: boolean };
          setPathStatus(body.exists ? 'taken' : 'available');
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) {
            return;
          }
          channelLogger.warn('failed to check document existence', {
            reason: reason instanceof Error ? reason.message : String(reason),
          });
          setPathStatus('idle');
        });
    },
    [applicationId],
  );

  const handleFileChange = (next: File | null) => {
    // A discrete file pick supersedes any pending folder-debounce check.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setFile(next);
    if (next && !overwrite) {
      // Validate the moment a file is chosen — no debounce for a one-off pick.
      runPathCheck(next, trimmedFolder);
    } else {
      // No file, or overwrite is on (validation intentionally skipped).
      checkAbortRef.current?.abort();
      setPathStatus('idle');
    }
  };

  const handleFolderChange = (value?: string) => {
    const nextFolder = value ?? '';
    setFolder(nextFolder);
    // Nothing to validate without a file, and overwrite skips validation entirely.
    if (!file || overwrite) {
      return;
    }
    // Debounce like a username-availability field: check after the user pauses typing.
    checkAbortRef.current?.abort();
    setPathStatus('checking');
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      runPathCheck(file, nextFolder.trim());
    }, FOLDER_CHECK_DEBOUNCE_MS);
  };

  const handleOverwriteChange = (value?: boolean) => {
    const next = Boolean(value);
    setOverwrite(next);
    if (next) {
      // Overwrite allowed → stop validating and drop any pending/known result.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      checkAbortRef.current?.abort();
      setPathStatus('idle');
    } else if (file) {
      // Back to enforcing uniqueness → re-validate the current path immediately.
      runPathCheck(file, trimmedFolder);
    }
  };

  // Cancel any in-flight check / pending debounce when the dialog unmounts.
  useEffect(() => {
    return () => {
      checkAbortRef.current?.abort();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleSubmit = async () => {
    // The submit button is disabled without a file / with a taken path, but guard anyway.
    if (!file || pathTaken) {
      return;
    }

    const formData = new FormData();
    formData.append('attachment', file);
    // metadata is only ever populated by the schema form, so a non-empty check is sufficient.
    if (Object.keys(metadata).length > 0) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const params = new URLSearchParams({ applicationId });
    if (trimmedFolder) {
      params.set('folder', trimmedFolder);
    }
    if (overwrite) {
      params.set('overwrite', 'true');
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
      disableSubmitButton={!file || pathTaken}
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        <SingleFilePicker
          file={file}
          onFileChange={handleFileChange}
          acceptTypes={PDF_MIME_TYPE}
          emptyTextFirstLine="Drag & drop your PDF here"
          emptyTextSecondLine="or click to browse"
          emptyButtonLabel="Select file"
          fileFormatError="Only PDF files are supported."
        />
        <DialFormItem label="Folder">
          <DialInput
            placeholder="e.g. reports/2026"
            value={folder}
            onChange={handleFolderChange}
          />
        </DialFormItem>
        <DialCheckbox
          id="overwrite-existing"
          label="Overwrite if a document already exists at this path"
          checked={overwrite}
          onChange={handleOverwriteChange}
        />
        {overwrite && file && (
          <p className="text-secondary text-xs">
            Existence check skipped — an existing document at this path will be
            overwritten.
          </p>
        )}
        {!overwrite && file && pathStatus !== 'idle' && (
          <PathAvailability
            status={pathStatus}
            filename={file.name}
            folder={trimmedFolder}
          />
        )}
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
              onDefaultValues={setMetadata}
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

/** Inline availability hint shown under the file/folder fields while a path is being validated. */
function PathAvailability({
  status,
  filename,
  folder,
}: {
  status: Exclude<PathStatus, 'idle'>;
  filename: string;
  folder: string;
}) {
  const location = folder ? ` in "${folder}"` : '';

  if (status === 'checking') {
    return (
      <p className="text-secondary flex items-center gap-1.5 text-xs">
        <IconLoader2 size={14} className="animate-spin" />
        Checking whether this file path is available…
      </p>
    );
  }

  if (status === 'available') {
    return (
      <p className="text-success flex items-center gap-1.5 text-xs">
        <IconCircleCheck size={14} className="shrink-0" />
        This file path is available.
      </p>
    );
  }

  return (
    <p role="alert" className="text-error flex items-start gap-1.5 text-xs">
      <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span>
        A document named &quot;{filename}&quot; already exists{location}.
        Uploading will overwrite it — rename the file or choose another folder.
      </span>
    </p>
  );
}
