import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildDocumentsListUrl,
  buildMetadataUrl,
  getMetadata,
  listDocuments,
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
