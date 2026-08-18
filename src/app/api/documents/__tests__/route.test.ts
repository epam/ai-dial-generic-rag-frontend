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
    uploadDocument: vi.fn(),
  };
});

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  listDocuments,
  uploadDocument,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { GET, POST } from '@/app/api/documents/route';

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/documents${query}`);
}

// jsdom's FormData/File do not survive NextRequest's undici multipart round-trip, so stub the
// parsed body directly — this unit-tests the handler's validation/forwarding, not undici's parser.
function makePostRequest(query: string, body: FormData): NextRequest {
  return {
    nextUrl: new URL(`http://localhost/api/documents${query}`),
    formData: async () => body,
  } as unknown as NextRequest;
}

function pdfFile(name = 'a.pdf'): File {
  return new File(['pdf-bytes'], name, { type: 'application/pdf' });
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
    vi.mocked(uploadDocument).mockReset();
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
      searchParams: {},
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
      searchParams: {},
      accessToken: undefined,
    });
  });

  it('forwards sort/filter query params to listDocuments', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(listDocuments).mockResolvedValue({
      total_count: 0,
      offset: 0,
      limit: 25,
      results: [],
    });

    await GET(
      makeRequest(
        '?applicationId=my-app&offset=0&limit=25&sort=display_name&order=asc&display_name=report',
      ),
    );

    expect(listDocuments).toHaveBeenCalledWith({
      applicationId: 'my-app',
      offset: 0,
      limit: 25,
      searchParams: {
        sort: 'display_name',
        order: 'asc',
        display_name: 'report',
      },
      accessToken: 'token-123',
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

describe('POST /api/documents', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getAccessToken).mockReset();
    vi.mocked(uploadDocument).mockReset();
  });

  it('returns 400 when applicationId is missing', async () => {
    const body = new FormData();
    body.append('attachment', pdfFile());

    const response = await POST(makePostRequest('', body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'applicationId query parameter is required',
    });
    expect(uploadDocument).not.toHaveBeenCalled();
  });

  it('returns 400 when the attachment file is missing', async () => {
    const body = new FormData();
    body.append('metadata', '{}');

    const response = await POST(makePostRequest('?applicationId=my-app', body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'attachment file is required',
    });
    expect(uploadDocument).not.toHaveBeenCalled();
  });

  it('forwards the attachment, folder, and metadata and returns 201', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    const created = {
      id: 7,
      url: 'u',
      display_name: 'a.pdf',
      mime_type: 'application/pdf',
      size: 3,
      status: 'created' as const,
    };
    vi.mocked(uploadDocument).mockResolvedValue(created);

    const body = new FormData();
    body.append('attachment', pdfFile());
    body.append('metadata', '{"publication_type":"report"}');

    const response = await POST(
      makePostRequest('?applicationId=my-app&folder=reports', body),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(created);

    const callArg = vi.mocked(uploadDocument).mock.calls[0][0];
    expect(callArg.applicationId).toBe('my-app');
    expect(callArg.folder).toBe('reports');
    expect(callArg.overwrite).toBe(false);
    expect(callArg.accessToken).toBe('token-123');
    const attachment = callArg.formData.get('attachment');
    expect(attachment).toBeInstanceOf(File);
    expect((attachment as File).name).toBe('a.pdf');
    expect(callArg.formData.get('metadata')).toBe(
      '{"publication_type":"report"}',
    );
  });

  it('forwards overwrite=true to uploadDocument when the query param is set', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(uploadDocument).mockResolvedValue({
      id: 8,
      url: 'u',
      display_name: 'a.pdf',
      mime_type: 'application/pdf',
      size: 1,
      status: 'created' as const,
    });

    const body = new FormData();
    body.append('attachment', pdfFile());

    const response = await POST(
      makePostRequest('?applicationId=my-app&overwrite=true', body),
    );

    expect(response.status).toBe(201);
    const callArg = vi.mocked(uploadDocument).mock.calls[0][0];
    expect(callArg.overwrite).toBe(true);
  });

  it('returns 502 when the channel upload returns a non-OK status', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(uploadDocument).mockRejectedValue(new UpstreamRequestError(422));

    const body = new FormData();
    body.append('attachment', pdfFile());

    const response = await POST(makePostRequest('?applicationId=my-app', body));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Failed to upload document',
    });
  });

  it('returns 502 when the upload fails unexpectedly', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(uploadDocument).mockRejectedValue(new Error('boom'));

    const body = new FormData();
    body.append('attachment', pdfFile());

    const response = await POST(makePostRequest('?applicationId=my-app', body));

    expect(response.status).toBe(502);
  });
});
