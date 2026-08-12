import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
}));

import { ImportBundleDialog } from '@/components/documents/ImportBundleDialog';

function bundleFile(name = 'report.pdf.msgpack'): File {
  return new File(['bundle-bytes'], name, { type: 'application/octet-stream' });
}

function selectFile() {
  fireEvent.change(screen.getByTestId('file-area'), {
    target: { files: [bundleFile()] },
  });
}

describe('ImportBundleDialog', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the warnings up front and keeps Import disabled until a bundle is chosen', () => {
    render(
      <ImportBundleDialog
        applicationId="my-app"
        onClose={vi.fn()}
        onImported={vi.fn()}
      />,
    );

    // Warnings are visible before any file is picked — no separate confirm step.
    expect(screen.getByText('Before you import')).toBeInTheDocument();

    const importButton = screen.getByRole('button', { name: 'Import' });
    expect(importButton).toBeDisabled();
    expect(screen.getByTestId('file-area').dataset.accept).toBe('.msgpack');

    selectFile();
    expect(importButton).toBeEnabled();
  });

  it('posts the bundle and calls onImported on success', async () => {
    const created = {
      id: 9,
      url: 'u',
      display_name: 'report.pdf',
      mime_type: 'application/pdf',
      size: 3,
      status: 'created',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 201, json: async () => created });
    vi.stubGlobal('fetch', fetchMock);
    const onImported = vi.fn();

    render(
      <ImportBundleDialog
        applicationId="my-app"
        onClose={vi.fn()}
        onImported={onImported}
      />,
    );

    selectFile();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(onImported).toHaveBeenCalledWith(created));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/documents/import?applicationId=my-app');
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('attachment')).toBeInstanceOf(File);
  });

  it('shows the concise message with the verbose detail as the hover title', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: 'Bundle schema mismatch',
        errorDetail: 'the full verbose diagnostic text',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onImported = vi.fn();

    render(
      <ImportBundleDialog
        applicationId="my-app"
        onClose={vi.fn()}
        onImported={onImported}
      />,
    );

    selectFile();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Bundle schema mismatch');
    expect(alert).toHaveAttribute('title', 'the full verbose diagnostic text');
    expect(onImported).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the error response has no body message', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ImportBundleDialog
        applicationId="my-app"
        onClose={vi.fn()}
        onImported={vi.fn()}
      />,
    );

    selectFile();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to import the bundle');
    // No verbose detail → the title falls back to the visible text.
    expect(alert).toHaveAttribute('title', alert.textContent ?? '');
  });
});
