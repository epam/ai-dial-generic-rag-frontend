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
    deleteDocument: vi.fn(),
  };
});

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  deleteDocument,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { DELETE } from '@/app/api/documents/[id]/route';

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/documents/7${query}`);
}

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe('DELETE /api/documents/[id]', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getAccessToken).mockReset();
    vi.mocked(deleteDocument).mockReset();
  });

  it('returns 400 when applicationId is missing', async () => {
    const response = await DELETE(makeRequest(), ctx('7'));

    expect(response.status).toBe(400);
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it('returns 400 when the id is not numeric', async () => {
    const response = await DELETE(
      makeRequest('?applicationId=my-app'),
      ctx('abc'),
    );

    expect(response.status).toBe(400);
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it('deletes the document and returns 204', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(deleteDocument).mockResolvedValue(undefined);

    const response = await DELETE(
      makeRequest('?applicationId=my-app'),
      ctx('7'),
    );

    expect(deleteDocument).toHaveBeenCalledWith({
      applicationId: 'my-app',
      id: 7,
      accessToken: 'token-123',
    });
    expect(response.status).toBe(204);
  });

  it('returns 502 when the channel delete returns a non-OK status', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(deleteDocument).mockRejectedValue(new UpstreamRequestError(404));

    const response = await DELETE(
      makeRequest('?applicationId=my-app'),
      ctx('7'),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Failed to delete document',
    });
  });

  it('returns 502 when the delete fails unexpectedly', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(deleteDocument).mockRejectedValue(new Error('boom'));

    const response = await DELETE(
      makeRequest('?applicationId=my-app'),
      ctx('7'),
    );

    expect(response.status).toBe(502);
  });
});
