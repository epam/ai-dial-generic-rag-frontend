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
  ButtonVariant: { Primary: 'primary', Neutral: 'neutral' },
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
  DialButton: (props: {
    label?: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={props.onClick} disabled={props.disabled}>
      {props.label}
    </button>
  ),
  DialErrorText: (props: { text?: string }) =>
    props.text ? <p data-testid="error-text">{props.text}</p> : null,
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

  it('accepts .msgpack bundles and keeps "Next" disabled until a file is chosen', () => {
    render(
      <ImportBundleDialog
        applicationId="my-app"
        onClose={vi.fn()}
        onImported={vi.fn()}
      />,
    );

    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
    expect(screen.getByTestId('file-area').dataset.accept).toBe('.msgpack');

    selectFile();
    expect(next).toBeEnabled();
  });

  it('shows warnings on the confirm step and can go back to file selection', () => {
    render(
      <ImportBundleDialog
        applicationId="my-app"
        onClose={vi.fn()}
        onImported={vi.fn()}
      />,
    );

    selectFile();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Confirm step: warnings + Import button, no file area.
    expect(screen.getByText('Before you import')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
    expect(screen.queryByTestId('file-area')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('file-area')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(onImported).toHaveBeenCalledWith(created));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/documents/import?applicationId=my-app');
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('attachment')).toBeInstanceOf(File);
  });

  it('shows the invalid-bundle message on a 422 and does not call onImported', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 422, json: async () => ({}) });
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
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() =>
      expect(screen.getByTestId('error-text')).toHaveTextContent(
        'not a valid or compatible document bundle',
      ),
    );
    expect(onImported).not.toHaveBeenCalled();
  });
});
