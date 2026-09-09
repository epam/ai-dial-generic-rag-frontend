/**
 * The channel-wide export archive, prepared asynchronously by the backend:
 * `PUT channel/export` starts preparation, `GET channel/export/status` reports progress, and
 * `GET channel/export` streams the finished archive.
 */
export type ChannelArchiveStatus =
  /** An archive is prepared and can be downloaded. */
  | 'ready'
  /** Preparation is in progress; poll the status endpoint until it settles. */
  | 'pending'
  /** No archive exists yet — preparation has never been triggered (or was discarded). */
  | 'not_found'
  /** Preparation failed on the backend; triggering it again is the only recovery. */
  | 'error';

/** Body returned by both the trigger (`202`) and the status (`200`) endpoints. */
export interface ChannelArchiveResponse {
  status: ChannelArchiveStatus;
}
