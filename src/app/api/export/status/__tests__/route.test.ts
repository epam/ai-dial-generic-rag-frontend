import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/export/status/route';
import type { ChannelArchiveStatus } from '@/types/channel-export';
import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  getChannelExportStatus,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';

vi.mock('@/utils/auth/get-access-token', () => ({
  getAccessToken: vi.fn(),
}));

vi.mock('@/utils/channel/channel-api', async () => {
  const actual = await vi.importActual<
    typeof import('@/utils/channel/channel-api')
  >('@/utils/channel/channel-api');
  return { ...actual, getChannelExportStatus: vi.fn() };
});

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/export/status${query}`);
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(getAccessToken).mockReset();
  vi.mocked(getChannelExportStatus).mockReset();
});

describe('GET /api/export/status', () => {
  it('returns 400 when applicationId is missing', async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'applicationId query parameter is required',
    });
    expect(getChannelExportStatus).not.toHaveBeenCalled();
  });

  it('passes the access token through to the channel', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(getChannelExportStatus).mockResolvedValue({ status: 'ready' });

    await GET(makeRequest('?applicationId=app-1'));

    expect(getChannelExportStatus).toHaveBeenCalledWith({
      applicationId: 'app-1',
      accessToken: 'token-123',
    });
  });

  it.each<ChannelArchiveStatus>(['ready', 'pending', 'not_found', 'error'])(
    'passes the %s status through as a 200 body',
    async (status) => {
      vi.mocked(getAccessToken).mockResolvedValue(undefined);
      vi.mocked(getChannelExportStatus).mockResolvedValue({ status });

      const response = await GET(makeRequest('?applicationId=app-1'));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ status });
    },
  );

  it('returns 502 when the channel responds with a non-OK status', async () => {
    vi.mocked(getAccessToken).mockResolvedValue(undefined);
    vi.mocked(getChannelExportStatus).mockRejectedValue(
      new UpstreamRequestError(422),
    );

    const response = await GET(makeRequest('?applicationId=app-1'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to read the channel export status',
    });
  });

  it('returns 502 on an unexpected failure', async () => {
    vi.mocked(getAccessToken).mockResolvedValue(undefined);
    vi.mocked(getChannelExportStatus).mockRejectedValue(new Error('boom'));

    const response = await GET(makeRequest('?applicationId=app-1'));

    expect(response.status).toBe(502);
  });
});
