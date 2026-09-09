import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET, PUT } from '@/app/api/export/route';
import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  downloadChannelExport,
  triggerChannelExport,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';

vi.mock('@/utils/auth/get-access-token', () => ({
  getAccessToken: vi.fn(),
}));

vi.mock('@/utils/channel/channel-api', async () => {
  const actual = await vi.importActual<
    typeof import('@/utils/channel/channel-api')
  >('@/utils/channel/channel-api');
  return {
    ...actual,
    triggerChannelExport: vi.fn(),
    downloadChannelExport: vi.fn(),
  };
});

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/export${query}`);
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(getAccessToken).mockReset();
  vi.mocked(triggerChannelExport).mockReset();
  vi.mocked(downloadChannelExport).mockReset();
});

describe('PUT /api/export', () => {
  it('returns 400 when applicationId is missing', async () => {
    const response = await PUT(makeRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'applicationId query parameter is required',
    });
    expect(triggerChannelExport).not.toHaveBeenCalled();
  });

  it('triggers preparation and returns 202 with the initial status', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(triggerChannelExport).mockResolvedValue({ status: 'pending' });

    const response = await PUT(makeRequest('?applicationId=app-1'));

    expect(triggerChannelExport).toHaveBeenCalledWith({
      applicationId: 'app-1',
      accessToken: 'token-123',
    });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ status: 'pending' });
  });

  it('returns 502 when the channel responds with a non-OK status', async () => {
    vi.mocked(getAccessToken).mockResolvedValue(undefined);
    vi.mocked(triggerChannelExport).mockRejectedValue(
      new UpstreamRequestError(422),
    );

    const response = await PUT(makeRequest('?applicationId=app-1'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to start the channel export',
    });
  });
});

describe('GET /api/export', () => {
  it('returns 400 when applicationId is missing', async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(400);
    expect(downloadChannelExport).not.toHaveBeenCalled();
  });

  it('streams the archive, forwarding the upstream headers', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(downloadChannelExport).mockResolvedValue(
      new Response('archive-bytes', {
        headers: {
          'content-type': 'application/zip',
          'content-disposition': 'attachment; filename="my-channel.zip"',
        },
      }),
    );

    const response = await GET(makeRequest('?applicationId=app-1'));

    expect(downloadChannelExport).toHaveBeenCalledWith({
      applicationId: 'app-1',
      accessToken: 'token-123',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="my-channel.zip"',
    );
  });

  it('synthesizes a Content-Disposition when the upstream sends none', async () => {
    vi.mocked(getAccessToken).mockResolvedValue(undefined);
    vi.mocked(downloadChannelExport).mockResolvedValue(
      new Response('archive-bytes'),
    );

    const response = await GET(makeRequest('?applicationId=app-1'));

    expect(response.headers.get('content-disposition')).toContain(
      'filename="channel-export.zip"',
    );
  });

  it('uses the filename query param as the fallback name', async () => {
    vi.mocked(getAccessToken).mockResolvedValue(undefined);
    vi.mocked(downloadChannelExport).mockResolvedValue(
      new Response('archive-bytes'),
    );

    const response = await GET(
      makeRequest('?applicationId=app-1&filename=my-app.zip'),
    );

    expect(response.headers.get('content-disposition')).toContain(
      'filename="my-app.zip"',
    );
  });

  it('returns 502 when the channel responds with a non-OK status', async () => {
    vi.mocked(getAccessToken).mockResolvedValue(undefined);
    vi.mocked(downloadChannelExport).mockRejectedValue(
      new UpstreamRequestError(422),
    );

    const response = await GET(makeRequest('?applicationId=app-1'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to download the channel export archive',
    });
  });
});
