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
    importDocument: vi.fn(),
  };
});

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  importDocument,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { POST } from '@/app/api/documents/import/route';

// jsdom's FormData/File do not survive NextRequest's undici multipart round-trip, so stub the parsed
// body directly — this unit-tests the handler's validation/forwarding, not undici's parser.
function makePostRequest(query: string, body: FormData): NextRequest {
  return {
    nextUrl: new URL(`http://localhost/api/documents/import${query}`),
    formData: async () => body,
  } as unknown as NextRequest;
}

function bundleFile(name = 'report.pdf.msgpack'): File {
  return new File(['bundle-bytes'], name, { type: 'application/octet-stream' });
}

describe('POST /api/documents/import', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getAccessToken).mockReset();
    vi.mocked(importDocument).mockReset();
  });

  it('returns 400 when applicationId is missing', async () => {
    const body = new FormData();
    body.append('attachment', bundleFile());

    const response = await POST(makePostRequest('', body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'applicationId query parameter is required',
    });
    expect(importDocument).not.toHaveBeenCalled();
  });

  it('returns 400 when the attachment file is missing', async () => {
    const body = new FormData();

    const response = await POST(makePostRequest('?applicationId=my-app', body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'attachment file is required',
    });
    expect(importDocument).not.toHaveBeenCalled();
  });

  it('forwards only the attachment file and returns 201', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    const created = {
      id: 9,
      url: 'u',
      display_name: 'report.pdf',
      mime_type: 'application/pdf',
      size: 3,
      status: 'created' as const,
    };
    vi.mocked(importDocument).mockResolvedValue(created);

    const body = new FormData();
    body.append('attachment', bundleFile());
    body.append('unexpected', 'should-not-forward');

    const response = await POST(makePostRequest('?applicationId=my-app', body));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(created);

    const callArg = vi.mocked(importDocument).mock.calls[0][0];
    expect(callArg.applicationId).toBe('my-app');
    expect(callArg.accessToken).toBe('token-123');
    expect((callArg.formData.get('attachment') as File).name).toBe(
      'report.pdf.msgpack',
    );
    expect(callArg.formData.get('unexpected')).toBeNull();
  });

  it('returns 422 with an actionable message when the bundle is rejected', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(importDocument).mockRejectedValue(new UpstreamRequestError(422));

    const body = new FormData();
    body.append('attachment', bundleFile());

    const response = await POST(makePostRequest('?applicationId=my-app', body));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: 'This file is not a valid or compatible document bundle.',
    });
  });

  it('returns 502 when the channel import returns another non-OK status', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(importDocument).mockRejectedValue(new UpstreamRequestError(500));

    const body = new FormData();
    body.append('attachment', bundleFile());

    const response = await POST(makePostRequest('?applicationId=my-app', body));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Failed to import document bundle',
    });
  });

  it('returns 502 when the import fails unexpectedly', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token-123');
    vi.mocked(importDocument).mockRejectedValue(new Error('boom'));

    const body = new FormData();
    body.append('attachment', bundleFile());

    const response = await POST(makePostRequest('?applicationId=my-app', body));

    expect(response.status).toBe(502);
  });
});
