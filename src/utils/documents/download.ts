/**
 * Downloads a document's original file through our proxy route. The route streams the file with a
 * `Content-Disposition: attachment` header, so a transient `<a download>` triggers the browser
 * save (no navigation). `applicationId` and the display name are passed as query params.
 */
export function downloadDocumentFile(
  applicationId: string,
  id: number,
  filename: string,
): void {
  // A plain content download: `display_name` is already the canonical name, so force it.
  triggerDownload(`/api/documents/${id}/download`, applicationId, filename, {
    downloadAttr: filename,
  });
}

/**
 * Exports a document's bundle (content + indexes) through our proxy route. The browser names the
 * file from the response's `Content-Disposition` (empty `download` attribute); `fallbackName` is
 * only a hint the proxy uses when the backend sends no such header.
 */
export function exportDocumentBundle(
  applicationId: string,
  id: number,
  fallbackName: string,
): void {
  triggerDownload(`/api/documents/${id}/export`, applicationId, fallbackName, {
    downloadAttr: '',
  });
}

/**
 * Downloads the prepared channel-wide export archive through our proxy route. Only call this once
 * the export status is `ready` — the channel rejects the request otherwise. The browser names the
 * file from the response's `Content-Disposition`; `fallbackName` is only a hint the proxy uses when
 * the backend sends no such header.
 */
export function downloadChannelExportArchive(
  applicationId: string,
  fallbackName: string,
): void {
  triggerDownload('/api/export', applicationId, fallbackName, {
    downloadAttr: '',
  });
}

/**
 * Triggers a browser download of a same-origin proxy route via a transient `<a>`. `filename` is
 * sent as a query param (the server-side name / fallback hint); `downloadAttr` is the anchor's
 * `download` value — a concrete name to force it, or `''` to defer to `Content-Disposition`.
 */
function triggerDownload(
  path: string,
  applicationId: string,
  filename: string,
  { downloadAttr }: { downloadAttr: string },
): void {
  const params = new URLSearchParams({ applicationId, filename });
  const anchor = document.createElement('a');
  anchor.href = `${path}?${params.toString()}`;
  anchor.download = downloadAttr;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
