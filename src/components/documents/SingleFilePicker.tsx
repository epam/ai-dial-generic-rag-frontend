'use client';

import { DialLoadFileArea } from '@epam/ai-dial-ui-kit';

interface SingleFilePickerProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  acceptTypes: string;
  emptyTextFirstLine: string;
  emptyTextSecondLine?: string;
  emptyButtonLabel: string;
  fileFormatError: string;
}

/**
 * A single-file drop zone shared by the document dialogs. Wraps `DialLoadFileArea` with the sized
 * parent it needs (its content is `h-full` internally, so it must be given a height) and the
 * `File | null` ↔ `File[]` adapter, so callers just deal in a single optional file.
 */
export function SingleFilePicker({
  file,
  onFileChange,
  acceptTypes,
  emptyTextFirstLine,
  emptyTextSecondLine,
  emptyButtonLabel,
  fileFormatError,
}: SingleFilePickerProps) {
  return (
    <div className="h-32 shrink-0">
      <DialLoadFileArea
        acceptTypes={acceptTypes}
        maxFilesCount={1}
        files={file ? [file] : []}
        onChange={(files) => onFileChange(files[0] ?? null)}
        emptyTextFirstLine={emptyTextFirstLine}
        emptyTextSecondLine={emptyTextSecondLine}
        emptyButtonLabel={emptyButtonLabel}
        fileFormatError={fileFormatError}
      />
    </div>
  );
}
