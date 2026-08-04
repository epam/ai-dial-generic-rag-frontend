import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  ConfirmationPopupVariant: { Info: 'info', Danger: 'danger' },
  DialConfirmationPopup: (props: {
    header?: ReactNode;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    isLoading?: boolean;
    children?: ReactNode;
  }) => (
    <div data-testid="confirm-popup">
      <div>{props.header}</div>
      {props.children}
      <button onClick={props.onConfirm} disabled={props.isLoading}>
        {props.confirmLabel ?? 'Ok'}
      </button>
      <button onClick={props.onCancel}>Cancel</button>
    </div>
  ),
  DialErrorText: (props: { text?: string }) =>
    props.text ? <p data-testid="error-text">{props.text}</p> : null,
}));

import { DeleteDocumentDialog } from '@/components/documents/DeleteDocumentDialog';
import type { Document } from '@/types/documents';

const DOC: Document = {
  id: 7,
  url: 'u',
  display_name: 'report.pdf',
  mime_type: 'application/pdf',
  size: 10,
  status: 'ready',
};

describe('DeleteDocumentDialog', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('deletes the document on confirm and calls onDeleted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const onDeleted = vi.fn();

    render(
      <DeleteDocumentDialog
        applicationId="my-app"
        document={DOC}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/documents/7?applicationId=my-app',
      { method: 'DELETE' },
    );
  });

  it('shows an error and does not call onDeleted when delete fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 502 }),
    );
    const onDeleted = vi.fn();

    render(
      <DeleteDocumentDialog
        applicationId="my-app"
        document={DOC}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(screen.getByTestId('error-text')).toBeInTheDocument(),
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
