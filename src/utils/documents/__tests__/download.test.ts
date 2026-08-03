import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadDocumentFile } from '@/utils/documents/download';

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
