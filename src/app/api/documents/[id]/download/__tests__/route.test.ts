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
    downloadDocument: vi.fn(),
  };
});

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  downloadDocument,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { GET } from '@/app/api/documents/[id]/download/route';

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/documents/7/download${query}`);
}

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/documents/[id]/download', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getAccessToken).mockReset();
    vi.mocked(downloadDocument).mockReset();
  });

  it('returns 400 when applicationId is missing', async () => {
    const response = await GET(makeRequest('?filename=a.pdf'), ctx('7'));

    expect(response.status).toBe(400);
    expect(downloadDocument).not.toHaveBeenCalled();
  });

  it('streams the file with attachment headers', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(downloadDocument).mockResolvedValue(
      new Response('file-bytes', {
        headers: { 'content-type': 'application/pdf' },
      }),
    );

    const response = await GET(
      makeRequest('?applicationId=my-app&filename=report.pdf'),
      ctx('7'),
    );

    expect(downloadDocument).toHaveBeenCalledWith({
      applicationId: 'my-app',
      id: 7,
      accessToken: 'token-123',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain(
      'filename="report.pdf"',
    );
    expect(await response.text()).toBe('file-bytes');
  });

  it('returns 502 when the channel download fails', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(downloadDocument).mockRejectedValue(
      new UpstreamRequestError(404),
    );

    const response = await GET(
      makeRequest('?applicationId=my-app&filename=a.pdf'),
      ctx('7'),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Failed to download document',
    });
  });
});
