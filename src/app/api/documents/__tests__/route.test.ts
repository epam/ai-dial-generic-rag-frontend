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
    listDocuments: vi.fn(),
  };
});

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  listDocuments,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { GET } from '@/app/api/documents/route';

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/documents${query}`);
}

describe('GET /api/documents', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getAccessToken).mockReset();
    vi.mocked(listDocuments).mockReset();
  });

  it('returns 400 when applicationId is missing', async () => {
    const response = await GET(makeRequest('?offset=0&limit=25'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'applicationId query parameter is required',
    });
    expect(listDocuments).not.toHaveBeenCalled();
  });

  it('returns the paginated documents on success', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    const body = { total_count: 1, offset: 0, limit: 25, results: [] };
    vi.mocked(listDocuments).mockResolvedValue(body);

    const response = await GET(
      makeRequest('?applicationId=my-app&offset=0&limit=25'),
    );

    expect(listDocuments).toHaveBeenCalledWith({
      applicationId: 'my-app',
      offset: 0,
      limit: 25,
      accessToken: 'token-123',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(body);
  });

  it('defaults offset to 0 and limit to 25 when absent', async () => {
    vi.mocked(getAccessToken).mockResolvedValue(undefined);
    vi.mocked(listDocuments).mockResolvedValue({
      total_count: 0,
      offset: 0,
      limit: 25,
      results: [],
    });

    await GET(makeRequest('?applicationId=my-app'));

    expect(listDocuments).toHaveBeenCalledWith({
      applicationId: 'my-app',
      offset: 0,
      limit: 25,
      accessToken: undefined,
    });
  });

  it('returns 502 when the upstream call fails unexpectedly', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(listDocuments).mockRejectedValue(new Error('boom'));

    const response = await GET(
      makeRequest('?applicationId=my-app&offset=0&limit=25'),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Failed to fetch documents',
    });
  });

  it('returns 502 when the channel API returns a non-OK status', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(listDocuments).mockRejectedValue(new UpstreamRequestError(500));

    const response = await GET(
      makeRequest('?applicationId=my-app&offset=0&limit=25'),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Failed to fetch documents',
    });
  });
});
