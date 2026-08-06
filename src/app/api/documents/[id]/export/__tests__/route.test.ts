import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/auth/get-access-token', () => ({
  getAccessToken: vi.fn(),
}));
vi.mock('@/utils/channel/channel-api', async () => {
  const actual = await vi.importActual<
    typeof import('@/utils/channel/channel-api')
  >('@/utils/channel/channel-api');
  return {
    ...actual,
    exportDocument: vi.fn(),
  };
});

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  exportDocument,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { GET } from '@/app/api/documents/[id]/export/route';

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/documents/7/export${query}`);
}

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/documents/[id]/export', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getAccessToken).mockReset();
    vi.mocked(exportDocument).mockReset();
  });

  it('returns 400 when applicationId is missing', async () => {
    const response = await GET(makeRequest('?filename=a.bundle'), ctx('7'));

    expect(response.status).toBe(400);
    expect(exportDocument).not.toHaveBeenCalled();
  });

  it('forwards the upstream Content-Disposition when present', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(exportDocument).mockResolvedValue(
      new Response('bundle-bytes', {
        headers: {
          'content-type': 'application/octet-stream',
          'content-disposition': 'attachment; filename="server-bundle.rag"',
        },
      }),
    );

    const response = await GET(
      makeRequest('?applicationId=my-app&filename=report.pdf.bundle'),
      ctx('7'),
    );

    expect(exportDocument).toHaveBeenCalledWith({
      applicationId: 'my-app',
      id: 7,
      accessToken: 'token-123',
    });
    expect(response.status).toBe(200);
    // The backend's own filename wins over the FE hint.
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="server-bundle.rag"',
    );
    expect(await response.text()).toBe('bundle-bytes');
  });

  it('falls back to the filename hint when the response has no Content-Disposition', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(exportDocument).mockResolvedValue(
      new Response('bundle-bytes', {
        headers: { 'content-type': 'application/octet-stream' },
      }),
    );

    const response = await GET(
      makeRequest('?applicationId=my-app&filename=report.pdf.bundle'),
      ctx('7'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain(
      'filename="report.pdf.bundle"',
    );
    expect(await response.text()).toBe('bundle-bytes');
  });

  it('returns 502 when the channel export fails', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(exportDocument).mockRejectedValue(new UpstreamRequestError(404));

    const response = await GET(
      makeRequest('?applicationId=my-app&filename=a.bundle'),
      ctx('7'),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Failed to export document',
    });
  });
});
