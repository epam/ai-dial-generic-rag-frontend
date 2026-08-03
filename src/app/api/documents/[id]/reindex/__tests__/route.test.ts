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
    reindexDocument: vi.fn(),
  };
});

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  reindexDocument,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { PUT } from '@/app/api/documents/[id]/reindex/route';

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/documents/7/reindex${query}`);
}

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe('PUT /api/documents/[id]/reindex', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getAccessToken).mockReset();
    vi.mocked(reindexDocument).mockReset();
  });

  it('returns 400 when applicationId is missing', async () => {
    const response = await PUT(makeRequest(), ctx('7'));

    expect(response.status).toBe(400);
    expect(reindexDocument).not.toHaveBeenCalled();
  });

  it('reindexes the document and returns 200 with the updated document', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    const updated = {
      id: 7,
      url: 'u',
      display_name: 'a.pdf',
      mime_type: 'application/pdf',
      size: 3,
      status: 'indexing' as const,
    };
    vi.mocked(reindexDocument).mockResolvedValue(updated);

    const response = await PUT(makeRequest('?applicationId=my-app'), ctx('7'));

    expect(reindexDocument).toHaveBeenCalledWith({
      applicationId: 'my-app',
      id: 7,
      accessToken: 'token-123',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(updated);
  });

  it('returns 502 when the channel reindex fails', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(reindexDocument).mockRejectedValue(new UpstreamRequestError(500));

    const response = await PUT(makeRequest('?applicationId=my-app'), ctx('7'));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Failed to reindex document',
    });
  });
});
