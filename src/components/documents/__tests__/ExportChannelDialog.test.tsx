import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChannelArchiveStatus } from '@/types/channel-export';

// Lightweight stand-ins for the ui-kit widgets so the test drives the dialog's own logic.
vi.mock('@epam/ai-dial-ui-kit', () => ({
  PopupSize: { Sm: 'sm', Md: 'md', Lg: 'lg' },
  NotificationVariant: {
    Info: 'info',
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
    Loading: 'loading',
  },
  DialFormPopup: (props: {
    header?: ReactNode;
    submitLabel?: string;
    onSubmit: () => void;
    onClose: () => void;
    onCancel?: () => void;
    disableSubmitButton?: boolean;
    children?: ReactNode;
  }) => (
    <div data-testid="form-popup">
      <div>{props.header}</div>
      {props.children}
      <button
        onClick={props.onSubmit}
        disabled={props.disableSubmitButton}
        data-testid="submit"
      >
        {props.submitLabel ?? 'Submit'}
      </button>
      <button onClick={props.onCancel ?? props.onClose}>Cancel</button>
    </div>
  ),
  DialNotification: (props: {
    variant?: string;
    title?: ReactNode;
    message: ReactNode;
  }) => (
    <div data-testid="notification" data-variant={props.variant}>
      <strong>{props.title}</strong>
      <span>{props.message}</span>
    </div>
  ),
  DialLoader: () => <span data-testid="loader" />,
}));

vi.mock('@/utils/documents/download', () => ({
  downloadChannelExportArchive: vi.fn(),
}));

import { ExportChannelDialog } from '@/components/documents/ExportChannelDialog';
import { downloadChannelExportArchive } from '@/utils/documents/download';

/** Stubs `fetch` so the status endpoint reports `status` and the trigger endpoint accepts. */
function mockStatus(status: ChannelArchiveStatus) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ status }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderDialog(overrides: { onDownloadStarted?: () => void } = {}) {
  const onClose = vi.fn();
  const onDownloadStarted = overrides.onDownloadStarted ?? vi.fn();
  render(
    <ExportChannelDialog
      applicationId="app-1"
      onClose={onClose}
      onDownloadStarted={onDownloadStarted}
    />,
  );
  return { onClose, onDownloadStarted };
}

const submit = () => screen.getByTestId('submit');

describe('ExportChannelDialog', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    // The module mock's vi.fn() survives restoreAllMocks, so clear its calls explicitly.
    vi.mocked(downloadChannelExportArchive).mockReset();
  });

  it('checks the archive status on open', async () => {
    const fetchMock = mockStatus('not_found');

    renderDialog();

    expect(screen.getByText('Checking archive status…')).toBeInTheDocument();
    expect(submit()).toBeDisabled();

    await waitFor(() =>
      expect(screen.getByText('No archive prepared yet')).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/export/status?applicationId=app-1',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it.each<[ChannelArchiveStatus, string, boolean]>([
    ['not_found', 'Prepare archive', true],
    ['pending', 'Preparing…', false],
    ['ready', 'Download', true],
    ['error', 'Try again', true],
  ])(
    'offers "%s" → label "%s" (enabled: %s)',
    async (status, label, enabled) => {
      mockStatus(status);

      renderDialog();

      await waitFor(() => expect(submit()).toHaveTextContent(label));
      if (enabled) {
        expect(submit()).toBeEnabled();
      } else {
        expect(submit()).toBeDisabled();
      }
    },
  );

  it('triggers preparation when no archive exists', async () => {
    const fetchMock = mockStatus('not_found');

    renderDialog();
    await waitFor(() => expect(submit()).toHaveTextContent('Prepare archive'));

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({ status: 'pending' }),
    });
    fireEvent.click(submit());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/export?applicationId=app-1',
        {
          method: 'PUT',
        },
      ),
    );
    await waitFor(() => expect(submit()).toHaveTextContent('Preparing…'));
    expect(submit()).toBeDisabled();
  });

  it('downloads the archive when it is ready', async () => {
    mockStatus('ready');
    const onDownloadStarted = vi.fn();

    renderDialog({ onDownloadStarted });
    await waitFor(() => expect(submit()).toHaveTextContent('Download'));

    fireEvent.click(submit());

    expect(downloadChannelExportArchive).toHaveBeenCalledWith(
      'app-1',
      'channel-export.zip',
    );
    expect(onDownloadStarted).toHaveBeenCalled();
  });

  it('surfaces a failed status check', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({
          error: 'Failed to read the channel export status',
          errorDetail: 'upstream 422',
        }),
      }),
    );

    renderDialog();

    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert).toHaveTextContent('Failed to read the channel export status');
    expect(alert).toHaveAttribute('title', 'upstream 422');
  });

  it('closes without acting when cancelled', async () => {
    mockStatus('ready');
    const { onClose } = renderDialog();
    await waitFor(() => expect(submit()).toHaveTextContent('Download'));

    fireEvent.click(screen.getByText('Cancel'));

    expect(onClose).toHaveBeenCalled();
    expect(downloadChannelExportArchive).not.toHaveBeenCalled();
  });
});
