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
    documentExists: vi.fn(),
  };
});

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  documentExists,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { GET } from '@/app/api/documents/exists/route';

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/documents/exists${query}`);
}

describe('GET /api/documents/exists', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getAccessToken).mockReset();
    vi.mocked(documentExists).mockReset();
  });

  it('returns 400 when applicationId is missing', async () => {
    const response = await GET(makeRequest('?filename=report.pdf'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'applicationId query parameter is required',
    });
    expect(documentExists).not.toHaveBeenCalled();
  });

  it('returns 400 when filename is missing', async () => {
    const response = await GET(makeRequest('?applicationId=my-app'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'filename query parameter is required',
    });
    expect(documentExists).not.toHaveBeenCalled();
  });

  it('returns the exists flag and forwards filename + folder', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(documentExists).mockResolvedValue(true);

    const response = await GET(
      makeRequest(
        '?applicationId=my-app&filename=report.pdf&folder=reports%2F2026',
      ),
    );

    expect(documentExists).toHaveBeenCalledWith({
      applicationId: 'my-app',
      filename: 'report.pdf',
      folder: 'reports/2026',
      accessToken: 'token-123',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ exists: true });
  });

  it('treats an empty folder as absent', async () => {
    vi.mocked(getAccessToken).mockResolvedValue(undefined);
    vi.mocked(documentExists).mockResolvedValue(false);

    await GET(makeRequest('?applicationId=my-app&filename=report.pdf&folder='));

    expect(documentExists).toHaveBeenCalledWith({
      applicationId: 'my-app',
      filename: 'report.pdf',
      folder: undefined,
      accessToken: undefined,
    });
  });

  it('returns 502 when the channel exists check returns a non-OK status', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(documentExists).mockRejectedValue(new UpstreamRequestError(500));

    const response = await GET(
      makeRequest('?applicationId=my-app&filename=report.pdf'),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Failed to check document existence',
    });
  });

  it('returns 502 when the exists check fails unexpectedly', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(documentExists).mockRejectedValue(new Error('boom'));

    const response = await GET(
      makeRequest('?applicationId=my-app&filename=report.pdf'),
    );

    expect(response.status).toBe(502);
  });
});
