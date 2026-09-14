'use client';

import {
  DialFormPopup,
  DialLoader,
  DialNotification,
  NotificationVariant,
  PopupSize,
} from '@epam/ai-dial-ui-kit';

import { useChannelExport } from '@/hooks/use-channel-export';
import type { ChannelArchiveStatus } from '@/types/channel-export';

/** The body message and submit-button label the dialog offers for each archive status. */
const STATUS_PRESENTATION: Record<
  ChannelArchiveStatus,
  {
    variant: NotificationVariant;
    title: string;
    message: string;
    submitLabel: string;
  }
> = {
  not_found: {
    variant: NotificationVariant.Info,
    title: 'No archive prepared yet',
    message:
      'Preparing the archive runs on the server and can take several minutes for a large channel.',
    submitLabel: 'Prepare archive',
  },
  pending: {
    variant: NotificationVariant.Loading,
    title: 'Preparing the archive',
    message:
      'This can take several minutes. You can close this dialog and reopen it later to check again.',
    submitLabel: 'Preparing…',
  },
  ready: {
    variant: NotificationVariant.Success,
    title: 'Archive is ready',
    message:
      'The archive covers the current state of the channel and is ready to download.',
    submitLabel: 'Download',
  },
  error: {
    variant: NotificationVariant.Error,
    title: 'Preparation failed',
    message:
      'The server could not prepare the archive. Starting the preparation again is the only way to recover.',
    submitLabel: 'Try again',
  },
};

interface ExportChannelDialogProps {
  applicationId: string;
  onClose: () => void;
  onDownloadStarted: () => void;
}

/**
 * Modal for exporting the whole channel as a single archive. Export is a two-step, asynchronous
 * backend operation, so the dialog reads the current archive status on open and offers exactly the
 * action that status permits — prepare, wait, download, or retry — rather than a single "Export"
 * button that could mean any of them. While preparation is `pending` it polls (see
 * {@link useChannelExport}); closing the dialog stops the polling and reopening resumes it.
 */
export function ExportChannelDialog({
  applicationId,
  onClose,
  onDownloadStarted,
}: ExportChannelDialogProps) {
  const { status, isPreparing, error, prepare, download } = useChannelExport({
    applicationId,
  });

  const presentation = status ? STATUS_PRESENTATION[status] : null;
  // `ready` is the only status whose action produces a file; the rest (re)start preparation, and
  // `pending` has no action at all.
  const canDownload = status === 'ready';
  const isBusy = isPreparing || status === 'pending' || status === null;

  const handleSubmit = () => {
    if (canDownload) {
      download();
      onDownloadStarted();
      return;
    }
    void prepare();
  };

  return (
    <DialFormPopup
      open
      header="Export channel"
      size={PopupSize.Md}
      submitLabel={presentation?.submitLabel ?? 'Prepare archive'}
      onClose={onClose}
      onCancel={onClose}
      onSubmit={handleSubmit}
      disableSubmitButton={isBusy}
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        <p className="text-secondary text-xs">
          Exports the entire channel — its documents and their index data — as a
          single archive. The server prepares the archive first; it can then be
          downloaded.
        </p>
        {presentation ? (
          <DialNotification
            variant={presentation.variant}
            title={presentation.title}
            message={presentation.message}
          />
        ) : (
          <div className="text-secondary flex items-center gap-2 text-xs">
            <DialLoader size={18} fullWidth={false} />
            <span>Checking archive status…</span>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="text-error truncate text-xs"
            title={error.full ?? error.text}
          >
            {error.text}
          </p>
        )}
      </div>
    </DialFormPopup>
  );
}
