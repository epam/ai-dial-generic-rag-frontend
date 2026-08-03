import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentMetadataSchema } from '@/types/metadata';

// Lightweight stand-ins for the ui-kit widgets so the test drives the dialog's own logic.
vi.mock('@epam/ai-dial-ui-kit', () => ({
  PopupSize: { Sm: 'sm', Md: 'md', Lg: 'lg' },
  DialFormPopup: (props: {
    header?: ReactNode;
    submitLabel?: string;
    onSubmit: () => void;
    onClose: () => void;
    onCancel?: () => void;
    disableSubmitButton?: boolean;
    isLoading?: boolean;
    children?: ReactNode;
  }) => (
    <div data-testid="form-popup">
      <div>{props.header}</div>
      {props.children}
      <button
        onClick={props.onSubmit}
        disabled={props.disableSubmitButton}
        data-loading={String(!!props.isLoading)}
      >
        {props.submitLabel ?? 'Submit'}
      </button>
      <button onClick={props.onCancel ?? props.onClose}>Cancel</button>
    </div>
  ),
  DialLoadFileArea: (props: {
    acceptTypes: string;
    onChange: (files: File[]) => void;
  }) => (
    <input
      data-testid="file-area"
      data-accept={props.acceptTypes}
      type="file"
      onChange={(event) =>
        props.onChange(event.target.files ? Array.from(event.target.files) : [])
      }
    />
  ),
  DialFormItem: (props: { label?: ReactNode; children?: ReactNode }) => (
    <label>
      {props.label}
      {props.children}
    </label>
  ),
  DialInput: (props: {
    value?: string;
    placeholder?: string;
    onChange?: (value?: string) => void;
  }) => (
    <input
      data-testid="folder-input"
      placeholder={props.placeholder}
      value={props.value}
      onChange={(event) => props.onChange?.(event.target.value)}
    />
  ),
  DialSchemaRenderer: (props: {
    onChange?: (value: Record<string, unknown>) => void;
  }) => (
    <button
      data-testid="schema-renderer"
      onClick={() => props.onChange?.({ publication_type: 'report' })}
    >
      set-metadata
    </button>
  ),
  DialErrorText: (props: { text?: string }) =>
    props.text ? <p data-testid="error-text">{props.text}</p> : null,
}));

import { AddDocumentDialog } from '@/components/documents/AddDocumentDialog';

const SCHEMA: DocumentMetadataSchema = {
  type: 'object',
  properties: { publication_type: { type: 'string' } },
};

function pdfFile(): File {
  return new File(['pdf-bytes'], 'report.pdf', { type: 'application/pdf' });
}

describe('AddDocumentDialog', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('accepts only PDFs and keeps submit disabled until a file is chosen', () => {
    render(
      <AddDocumentDialog
        applicationId="my-app"
        schema={SCHEMA}
        onClose={vi.fn()}
        onUploaded={vi.fn()}
      />,
    );

    const submit = screen.getByRole('button', { name: 'Add' });
    expect(submit).toBeDisabled();
    expect(screen.getByTestId('file-area').dataset.accept).toBe(
      'application/pdf',
    );

    fireEvent.change(screen.getByTestId('file-area'), {
      target: { files: [pdfFile()] },
    });
    expect(submit).toBeEnabled();
  });

  it('omits the metadata form when no schema is provided', () => {
    render(
      <AddDocumentDialog
        applicationId="my-app"
        schema={null}
        onClose={vi.fn()}
        onUploaded={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('schema-renderer')).not.toBeInTheDocument();
  });

  it('uploads the attachment, folder, and metadata then calls onUploaded', async () => {
    const created = {
      id: 5,
      url: 'u',
      display_name: 'report.pdf',
      mime_type: 'application/pdf',
      size: 9,
      status: 'created',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 201, json: async () => created });
    vi.stubGlobal('fetch', fetchMock);
    const onUploaded = vi.fn();

    render(
      <AddDocumentDialog
        applicationId="my-app"
        schema={SCHEMA}
        onClose={vi.fn()}
        onUploaded={onUploaded}
      />,
    );

    fireEvent.change(screen.getByTestId('file-area'), {
      target: { files: [pdfFile()] },
    });
    fireEvent.change(screen.getByTestId('folder-input'), {
      target: { value: 'reports/2026' },
    });
    fireEvent.click(screen.getByTestId('schema-renderer'));

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(created));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      '/api/documents?applicationId=my-app&folder=reports%2F2026',
    );
    expect(init.method).toBe('POST');
    const body = init.body as FormData;
    expect((body.get('attachment') as File).name).toBe('report.pdf');
    expect(body.get('metadata')).toBe('{"publication_type":"report"}');
  });

  it('shows an error and does not call onUploaded when the upload fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const onUploaded = vi.fn();

    render(
      <AddDocumentDialog
        applicationId="my-app"
        schema={SCHEMA}
        onClose={vi.fn()}
        onUploaded={onUploaded}
      />,
    );

    fireEvent.change(screen.getByTestId('file-area'), {
      target: { files: [pdfFile()] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(screen.getByTestId('error-text')).toBeInTheDocument(),
    );
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
