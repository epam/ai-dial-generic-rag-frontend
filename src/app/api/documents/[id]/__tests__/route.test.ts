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
    updateDocument: vi.fn(),
  };
});

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  deleteDocument,
  updateDocument,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { DELETE, PUT } from '@/app/api/documents/[id]/route';

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/documents/7${query}`);
}

// jsdom's FormData/File don't survive NextRequest's undici multipart round-trip, so stub the parsed
// body directly — this unit-tests the handler's validation/forwarding, not undici's parser.
function makePutRequest(query: string, body: FormData): NextRequest {
  return {
    nextUrl: new URL(`http://localhost/api/documents/7${query}`),
    formData: async () => body,
  } as unknown as NextRequest;
}

function pdfFile(name = 'a.pdf'): File {
  return new File(['pdf-bytes'], name, { type: 'application/pdf' });
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
    vi.mocked(updateDocument).mockReset();
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

describe('PUT /api/documents/[id]', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getAccessToken).mockReset();
    vi.mocked(updateDocument).mockReset();
  });

  it('returns 400 when applicationId is missing', async () => {
    const body = new FormData();
    body.append('metadata', '{}');

    const response = await PUT(makePutRequest('', body), ctx('7'));

    expect(response.status).toBe(400);
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it('forwards the attachment and metadata and returns the updated document', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    const updated = {
      id: 7,
      url: 'u',
      display_name: 'a.pdf',
      mime_type: 'application/pdf',
      size: 3,
      status: 'processing' as const,
    };
    vi.mocked(updateDocument).mockResolvedValue(updated);

    const body = new FormData();
    body.append('attachment', pdfFile());
    body.append('metadata', '{"publication_type":"sigma"}');
    body.append('unexpected', 'drop-me');

    const response = await PUT(
      makePutRequest('?applicationId=my-app', body),
      ctx('7'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(updated);

    const callArg = vi.mocked(updateDocument).mock.calls[0][0];
    expect(callArg.applicationId).toBe('my-app');
    expect(callArg.id).toBe(7);
    expect(callArg.accessToken).toBe('token-123');
    expect((callArg.formData.get('attachment') as File).name).toBe('a.pdf');
    expect(callArg.formData.get('metadata')).toBe(
      '{"publication_type":"sigma"}',
    );
    expect(callArg.formData.get('unexpected')).toBeNull();
  });

  it('supports a metadata-only update (no attachment)', async () => {
    vi.mocked(getAccessToken).mockResolvedValue(undefined);
    vi.mocked(updateDocument).mockResolvedValue({
      id: 7,
      url: 'u',
      display_name: 'a.pdf',
      mime_type: 'application/pdf',
      size: 3,
      status: 'ready' as const,
    });

    const body = new FormData();
    body.append('metadata', '{"publication_type":"SONAR"}');

    await PUT(makePutRequest('?applicationId=my-app', body), ctx('7'));

    const callArg = vi.mocked(updateDocument).mock.calls[0][0];
    expect(callArg.formData.get('attachment')).toBeNull();
    expect(callArg.formData.get('metadata')).toBe(
      '{"publication_type":"SONAR"}',
    );
  });

  it('returns a distinct 422 when the metadata violates the channel schema', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(updateDocument).mockRejectedValue(new UpstreamRequestError(422));

    const body = new FormData();
    body.append('metadata', '{}');

    const response = await PUT(
      makePutRequest('?applicationId=my-app', body),
      ctx('7'),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "The metadata doesn't match this channel's schema.",
    });
  });

  it('returns 502 when the update fails unexpectedly', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(updateDocument).mockRejectedValue(new Error('boom'));

    const body = new FormData();
    body.append('metadata', '{}');

    const response = await PUT(
      makePutRequest('?applicationId=my-app', body),
      ctx('7'),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Failed to update document',
    });
  });
});
