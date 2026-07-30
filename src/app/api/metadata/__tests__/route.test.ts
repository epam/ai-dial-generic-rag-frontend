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
    getMetadata: vi.fn(),
  };
});

import { getAccessToken } from '@/utils/auth/get-access-token';
import { getMetadata, UpstreamRequestError } from '@/utils/channel/channel-api';
import { GET } from '@/app/api/metadata/route';

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/metadata${query}`);
}

describe('GET /api/metadata', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getAccessToken).mockReset();
    vi.mocked(getMetadata).mockReset();
  });

  it('returns 400 when applicationId is missing', async () => {
    const response = await GET(makeRequest(''));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'applicationId query parameter is required',
    });
    expect(getMetadata).not.toHaveBeenCalled();
  });

  it('returns the metadata schema on success, forwarding the access token', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    const body = {
      schema: { type: 'object', properties: {} },
      dimensions: {},
    };
    vi.mocked(getMetadata).mockResolvedValue(body);

    const response = await GET(makeRequest('?applicationId=my-app'));

    expect(getMetadata).toHaveBeenCalledWith({
      applicationId: 'my-app',
      accessToken: 'token-123',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(body);
  });

  it('returns 502 when the upstream call fails unexpectedly', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(getMetadata).mockRejectedValue(new Error('boom'));

    const response = await GET(makeRequest('?applicationId=my-app'));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Failed to fetch document metadata',
    });
  });

  it('returns 502 when the channel API returns a non-OK status', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(getMetadata).mockRejectedValue(new UpstreamRequestError(500));

    const response = await GET(makeRequest('?applicationId=my-app'));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Failed to fetch document metadata',
    });
  });
});
