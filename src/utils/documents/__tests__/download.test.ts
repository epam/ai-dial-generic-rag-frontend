import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  downloadDocumentFile,
  exportDocumentBundle,
} from '@/utils/documents/download';

describe('downloadDocumentFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a download anchor with the proxied href and clicks it', () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    downloadDocumentFile('my-app', 7, 'report 2026.pdf');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toBe(
      '/api/documents/7/download?applicationId=my-app&filename=report+2026.pdf',
    );
    expect(anchor.download).toBe('report 2026.pdf');
    // The transient anchor is removed after the click.
    expect(document.body.contains(anchor)).toBe(false);
  });
});

describe('exportDocumentBundle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the fallback name as a query hint but defers naming to the response header', () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    exportDocumentBundle('my-app', 7, 'report.pdf.bundle');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toBe(
      '/api/documents/7/export?applicationId=my-app&filename=report.pdf.bundle',
    );
    // Empty `download` → the browser uses the response's Content-Disposition filename.
    expect(anchor.download).toBe('');
    expect(document.body.contains(anchor)).toBe(false);
  });
});
