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
  const params = new URLSearchParams({ applicationId, filename });
  const anchor = document.createElement('a');
  anchor.href = `/api/documents/${id}/download?${params.toString()}`;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
