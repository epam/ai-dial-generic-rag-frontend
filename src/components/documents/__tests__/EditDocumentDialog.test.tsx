import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Document } from '@/types/documents';
import type { DocumentMetadataSchema } from '@/types/metadata';

// Lightweight stand-ins so the test drives the dialog's own logic.
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
      <button onClick={props.onSubmit} disabled={props.disableSubmitButton}>
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
  DialSchemaRenderer: (props: {
    defaultValue?: unknown;
    onChange?: (value: Record<string, unknown>) => void;
  }) => (
    <button
      data-testid="schema-renderer"
      data-default={JSON.stringify(props.defaultValue)}
      onClick={() => props.onChange?.({ publication_type: 'edited' })}
    >
      edit-metadata
    </button>
  ),
  DialErrorText: (props: { text?: string }) =>
    props.text ? <p data-testid="error-text">{props.text}</p> : null,
}));

import { EditDocumentDialog } from '@/components/documents/EditDocumentDialog';

const SCHEMA: DocumentMetadataSchema = {
  type: 'object',
  properties: { publication_type: { type: 'string' } },
};

const DOC: Document = {
  id: 7,
  url: 'u',
  display_name: 'report.pdf',
  mime_type: 'application/pdf',
  size: 10,
  status: 'ready',
  metadata: { publication_type: 'sigma' },
};

function pdfFile(): File {
  return new File(['pdf-bytes'], 'new.pdf', { type: 'application/pdf' });
}

describe('EditDocumentDialog', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('pre-fills the metadata form from the document metadata', () => {
    render(
      <EditDocumentDialog
        applicationId="my-app"
        document={DOC}
        schema={SCHEMA}
        onClose={vi.fn()}
        onEdited={vi.fn()}
      />,
    );

    expect(screen.getByTestId('schema-renderer').dataset.default).toBe(
      JSON.stringify(DOC.metadata),
    );
  });

  it('PUTs the edited metadata and a replacement file, then calls onEdited', async () => {
    const updated = { ...DOC, status: 'processing' };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => updated });
    vi.stubGlobal('fetch', fetchMock);
    const onEdited = vi.fn();

    render(
      <EditDocumentDialog
        applicationId="my-app"
        document={DOC}
        schema={SCHEMA}
        onClose={vi.fn()}
        onEdited={onEdited}
      />,
    );

    fireEvent.click(screen.getByTestId('schema-renderer'));
    fireEvent.change(screen.getByTestId('file-area'), {
      target: { files: [pdfFile()] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onEdited).toHaveBeenCalledWith(updated));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/documents/7?applicationId=my-app');
    expect(init.method).toBe('PUT');
    const formData = init.body as FormData;
    expect((formData.get('attachment') as File).name).toBe('new.pdf');
    expect(formData.get('metadata')).toBe(
      JSON.stringify({ publication_type: 'edited' }),
    );
  });

  it('shows the response error message and does not call onEdited on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: "The metadata doesn't match this channel's schema.",
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onEdited = vi.fn();

    render(
      <EditDocumentDialog
        applicationId="my-app"
        document={DOC}
        schema={SCHEMA}
        onClose={vi.fn()}
        onEdited={onEdited}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.getByTestId('error-text')).toHaveTextContent(
        "doesn't match this channel's schema",
      ),
    );
    expect(onEdited).not.toHaveBeenCalled();
  });
});
