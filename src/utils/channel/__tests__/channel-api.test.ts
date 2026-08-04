import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildDocumentsListUrl,
  buildDocumentsUploadUrl,
  buildMetadataUrl,
  getMetadata,
  listDocuments,
  uploadDocument,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';

describe('buildDocumentsListUrl', () => {
  beforeEach(() => {
    vi.stubEnv('DIAL_API_URL', 'https://core.example.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the DIAL Core deployment route URL with offset/limit', () => {
    expect(buildDocumentsListUrl('my-app', 25, 10)).toBe(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents?offset=25&limit=10',
    );
  });

  it('encodes the application id', () => {
    expect(buildDocumentsListUrl('app/with slash', 0, 25)).toBe(
      'https://core.example.com/v1/deployments/app%2Fwith%20slash/route/channel/documents?offset=0&limit=25',
    );
  });

  it('appends extra search params (sort/filter) after offset/limit', () => {
    expect(
      buildDocumentsListUrl('my-app', 0, 25, {
        sort: 'display_name',
        order: 'asc',
        display_name: 'report',
      }),
    ).toBe(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents?offset=0&limit=25&sort=display_name&order=asc&display_name=report',
    );
  });

  it('throws when DIAL_API_URL is not configured', () => {
    vi.stubEnv('DIAL_API_URL', '');
    expect(() => buildDocumentsListUrl('my-app', 0, 25)).toThrow(
      'DIAL_API_URL is not configured',
    );
  });
});

describe('buildMetadataUrl', () => {
  beforeEach(() => {
    vi.stubEnv('DIAL_API_URL', 'https://core.example.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the DIAL Core deployment channel metadata URL', () => {
    expect(buildMetadataUrl('my-app')).toBe(
      'https://core.example.com/v1/deployments/my-app/route/channel/metadata',
    );
  });

  it('encodes the application id', () => {
    expect(buildMetadataUrl('app/with slash')).toBe(
      'https://core.example.com/v1/deployments/app%2Fwith%20slash/route/channel/metadata',
    );
  });

  it('throws when DIAL_API_URL is not configured', () => {
    vi.stubEnv('DIAL_API_URL', '');
    expect(() => buildMetadataUrl('my-app')).toThrow(
      'DIAL_API_URL is not configured',
    );
  });
});

describe('listDocuments', () => {
  beforeEach(() => {
    vi.stubEnv('DIAL_API_URL', 'https://core.example.com');
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('sends a bearer token header when accessToken is provided', async () => {
    const responseBody = { total_count: 1, offset: 0, limit: 25, results: [] };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => responseBody,
    });

    const result = await listDocuments({
      applicationId: 'my-app',
      offset: 0,
      limit: 25,
      accessToken: 'token-123',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents?offset=0&limit=25',
      { headers: { Authorization: 'Bearer token-123' } },
    );
    expect(result).toEqual(responseBody);
  });

  it('sends no Authorization header when accessToken is absent', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ total_count: 0, offset: 0, limit: 25, results: [] }),
    });

    await listDocuments({ applicationId: 'my-app', offset: 0, limit: 25 });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents?offset=0&limit=25',
      { headers: {} },
    );
  });

  it('appends search params (sort/filter) to the request URL', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ total_count: 0, offset: 0, limit: 25, results: [] }),
    });

    await listDocuments({
      applicationId: 'my-app',
      offset: 0,
      limit: 25,
      searchParams: { sort: 'display_name', order: 'asc' },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents?offset=0&limit=25&sort=display_name&order=asc',
      { headers: {} },
    );
  });

  it('throws an UpstreamRequestError carrying the status when the response is not ok', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({}),
    });

    const error = await listDocuments({
      applicationId: 'my-app',
      offset: 0,
      limit: 25,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamRequestError);
    expect((error as UpstreamRequestError).status).toBe(502);
    expect((error as UpstreamRequestError).message).toBe(
      'Failed to fetch documents: 502',
    );
  });
});

describe('getMetadata', () => {
  beforeEach(() => {
    vi.stubEnv('DIAL_API_URL', 'https://core.example.com');
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('sends a bearer token header when accessToken is provided', async () => {
    const responseBody = { schema: { type: 'object', properties: {} } };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => responseBody,
    });

    const result = await getMetadata({
      applicationId: 'my-app',
      accessToken: 'token-123',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/metadata',
      { headers: { Authorization: 'Bearer token-123' } },
    );
    expect(result).toEqual(responseBody);
  });

  it('sends no Authorization header when accessToken is absent', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ schema: { type: 'object', properties: {} } }),
    });

    await getMetadata({ applicationId: 'my-app' });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/metadata',
      { headers: {} },
    );
  });

  it('throws an UpstreamRequestError carrying the status when the response is not ok', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const error = await getMetadata({ applicationId: 'my-app' }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(UpstreamRequestError);
    expect((error as UpstreamRequestError).status).toBe(503);
  });
});

describe('buildDocumentsUploadUrl', () => {
  beforeEach(() => {
    vi.stubEnv('DIAL_API_URL', 'https://core.example.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the channel documents URL without a folder', () => {
    expect(buildDocumentsUploadUrl('my-app')).toBe(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents',
    );
  });

  it('appends the folder query parameter when provided', () => {
    expect(buildDocumentsUploadUrl('my-app', 'reports/2026')).toBe(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents?folder=reports%2F2026',
    );
  });
});

describe('uploadDocument', () => {
  beforeEach(() => {
    vi.stubEnv('DIAL_API_URL', 'https://core.example.com');
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('POSTs the form data with a bearer token and returns the created document', async () => {
    const created = {
      id: 1,
      url: 'u1',
      display_name: 'a.pdf',
      mime_type: 'application/pdf',
      size: 10,
      status: 'created',
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => created,
    });
    const formData = new FormData();

    const result = await uploadDocument({
      applicationId: 'my-app',
      formData,
      folder: 'reports',
      accessToken: 'token-123',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents?folder=reports',
      {
        method: 'POST',
        body: formData,
        headers: { Authorization: 'Bearer token-123' },
      },
    );
    expect(result).toEqual(created);
  });

  it('sends no Authorization header when accessToken is absent', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
    });
    const formData = new FormData();

    await uploadDocument({ applicationId: 'my-app', formData });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents',
      { method: 'POST', body: formData, headers: {} },
    );
  });

  it('throws an UpstreamRequestError carrying the status when the response is not ok', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({}),
    });

    const error = await uploadDocument({
      applicationId: 'my-app',
      formData: new FormData(),
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamRequestError);
    expect((error as UpstreamRequestError).status).toBe(422);
  });
});
