/**
 * Polling cadence for the channel export archive status. Preparation is a backend job with no
 * completion callback, so the dialog polls `GET /api/export/status` while it reports `pending`:
 * briskly at first (a small channel finishes in seconds), then slower once it is clearly a long
 * job, to keep a multi-minute export from hammering the backend.
 */
export const EXPORT_STATUS_POLL_INTERVAL_MS = 5_000;
export const EXPORT_STATUS_SLOW_POLL_INTERVAL_MS = 15_000;

/** How long the brisk interval applies, measured from the first `pending` status observed. */
export const EXPORT_STATUS_FAST_POLL_PERIOD_MS = 60_000;

/**
 * Name used for the downloaded archive only when the backend sends no `Content-Disposition`;
 * normally its own filename wins.
 */
export const CHANNEL_EXPORT_FALLBACK_FILENAME = 'channel-export.zip';
