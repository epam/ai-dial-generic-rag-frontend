import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildDocumentsExistsUrl,
  buildDocumentsListUrl,
  buildDocumentsUploadUrl,
  buildDocumentUrl,
  buildMetadataUrl,
  deleteDocument,
  documentExists,
  downloadDocument,
  exportDocument,
  getMetadata,
  listDocuments,
  reindexDocument,
  updateDocument,
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
    expect((error as UpstreamRequestError).detail).toBeUndefined();
  });

  it('captures a string error message from the response body as detail', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Bundle schema mismatch' }),
    });

    const error = await listDocuments({
      applicationId: 'my-app',
      offset: 0,
      limit: 25,
    }).catch((e: unknown) => e);

    expect((error as UpstreamRequestError).status).toBe(422);
    expect((error as UpstreamRequestError).detail).toBe(
      'Bundle schema mismatch',
    );
  });

  it('prefers the DIAL error envelope display_message over the verbose message', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: {
          message:
            "'external_url' is a required property\n\nFailed validating…",
          type: 'invalid_request_error',
          code: '422',
          display_message:
            "Value of metadata violates JSON schema: 'external_url' is a required property",
        },
      }),
    });

    const error = await listDocuments({
      applicationId: 'my-app',
      offset: 0,
      limit: 25,
    }).catch((e: unknown) => e);

    // Concise display_message for the block; verbose message kept for the hover tooltip.
    expect((error as UpstreamRequestError).detail).toBe(
      "Value of metadata violates JSON schema: 'external_url' is a required property",
    );
    expect((error as UpstreamRequestError).detailFull).toBe(
      "'external_url' is a required property\n\nFailed validating…",
    );
  });

  it('joins FastAPI validation errors into detail', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        detail: [{ msg: 'field required' }, { msg: 'value is not valid' }],
      }),
    });

    const error = await listDocuments({
      applicationId: 'my-app',
      offset: 0,
      limit: 25,
    }).catch((e: unknown) => e);

    expect((error as UpstreamRequestError).detail).toBe(
      'field required; value is not valid',
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

  it('appends overwrite=true when overwrite is set', () => {
    expect(buildDocumentsUploadUrl('my-app', undefined, true)).toBe(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents?overwrite=true',
    );
  });

  it('appends both folder and overwrite when provided', () => {
    expect(buildDocumentsUploadUrl('my-app', 'reports', true)).toBe(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents?folder=reports&overwrite=true',
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

  it('appends overwrite=true to the upload URL when overwrite is set', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
    });
    const formData = new FormData();

    await uploadDocument({
      applicationId: 'my-app',
      formData,
      folder: 'reports',
      overwrite: true,
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents?folder=reports&overwrite=true',
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

describe('buildDocumentsExistsUrl', () => {
  beforeEach(() => {
    vi.stubEnv('DIAL_API_URL', 'https://core.example.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the exists URL with the filename', () => {
    expect(buildDocumentsExistsUrl('my-app', 'report.pdf')).toBe(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents/exists?filename=report.pdf',
    );
  });

  it('appends the folder query parameter when provided', () => {
    expect(
      buildDocumentsExistsUrl('my-app', 'report.pdf', 'reports/2026'),
    ).toBe(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents/exists?filename=report.pdf&folder=reports%2F2026',
    );
  });
});

describe('documentExists', () => {
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

  it('GETs the exists URL with a bearer token and returns the flag', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ exists: true }),
    });

    const result = await documentExists({
      applicationId: 'my-app',
      filename: 'report.pdf',
      folder: 'reports',
      accessToken: 'token-123',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents/exists?filename=report.pdf&folder=reports',
      { headers: { Authorization: 'Bearer token-123' } },
    );
    expect(result).toBe(true);
  });

  it('omits the folder and Authorization header when absent', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ exists: false }),
    });

    const result = await documentExists({
      applicationId: 'my-app',
      filename: 'report.pdf',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents/exists?filename=report.pdf',
      { headers: {} },
    );
    expect(result).toBe(false);
  });

  it('throws an UpstreamRequestError carrying the status when the response is not ok', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({}),
    });

    const error = await documentExists({
      applicationId: 'my-app',
      filename: 'report.pdf',
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamRequestError);
    expect((error as UpstreamRequestError).status).toBe(422);
  });
});

describe('buildDocumentUrl', () => {
  beforeEach(() => {
    vi.stubEnv('DIAL_API_URL', 'https://core.example.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the id-scoped document URL', () => {
    expect(buildDocumentUrl('my-app', 7)).toBe(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents/7',
    );
  });

  it('appends a sub-path when given', () => {
    expect(buildDocumentUrl('my-app', 7, 'reindex')).toBe(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents/7/reindex',
    );
  });
});

describe('single-document operations', () => {
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

  it('deleteDocument sends DELETE with the bearer token', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 204,
    });

    await deleteDocument({
      applicationId: 'my-app',
      id: 7,
      accessToken: 'token-123',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents/7',
      { method: 'DELETE', headers: { Authorization: 'Bearer token-123' } },
    );
  });

  it('deleteDocument throws an UpstreamRequestError on a non-OK status', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    });

    const error = await deleteDocument({
      applicationId: 'my-app',
      id: 7,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamRequestError);
    expect((error as UpstreamRequestError).status).toBe(404);
  });

  it('reindexDocument PUTs and returns the updated document', async () => {
    const updated = {
      id: 7,
      url: 'u',
      display_name: 'a.pdf',
      mime_type: 'application/pdf',
      size: 3,
      status: 'indexing',
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => updated,
    });

    const result = await reindexDocument({ applicationId: 'my-app', id: 7 });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents/7/reindex',
      { method: 'PUT', headers: {} },
    );
    expect(result).toEqual(updated);
  });

  it('updateDocument PUTs the form data to documents/{id} and returns the document', async () => {
    const updated = {
      id: 7,
      url: 'u',
      display_name: 'a.pdf',
      mime_type: 'application/pdf',
      size: 3,
      status: 'processing',
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => updated,
    });
    const formData = new FormData();

    const result = await updateDocument({
      applicationId: 'my-app',
      id: 7,
      formData,
      accessToken: 'token-123',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents/7',
      {
        method: 'PUT',
        body: formData,
        headers: { Authorization: 'Bearer token-123' },
      },
    );
    expect(result).toEqual(updated);
  });

  it('downloadDocument returns the raw response for streaming', async () => {
    const response = { ok: true, status: 200, body: 'stream' };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const result = await downloadDocument({
      applicationId: 'my-app',
      id: 7,
      accessToken: 'token-123',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents/7/download',
      { headers: { Authorization: 'Bearer token-123' } },
    );
    expect(result).toBe(response);
  });

  it('downloadDocument throws an UpstreamRequestError on a non-OK status', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 502,
    });

    const error = await downloadDocument({
      applicationId: 'my-app',
      id: 7,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamRequestError);
    expect((error as UpstreamRequestError).status).toBe(502);
  });

  it('exportDocument returns the raw bundle response for streaming', async () => {
    const response = { ok: true, status: 200, body: 'bundle' };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const result = await exportDocument({
      applicationId: 'my-app',
      id: 7,
      accessToken: 'token-123',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://core.example.com/v1/deployments/my-app/route/channel/documents/7/export',
      { headers: { Authorization: 'Bearer token-123' } },
    );
    expect(result).toBe(response);
  });

  it('exportDocument throws an UpstreamRequestError on a non-OK status', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 502,
    });

    const error = await exportDocument({
      applicationId: 'my-app',
      id: 7,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamRequestError);
    expect((error as UpstreamRequestError).status).toBe(502);
  });
});
