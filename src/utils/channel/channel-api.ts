import type { Document, PaginatedDocuments } from '@/types/documents';
import type { ChannelMetadata } from '@/types/metadata';
import { channelLogger } from '@/utils/channel/logger';

/**
 * Thrown when the channel API responds with a non-OK status — an anticipated condition (e.g. an
 * unknown/misconfigured `application_id`), not a bug in this app. Callers should log this at
 * `warn` with the request context, not `error` with a full stack trace.
 */
export class UpstreamRequestError extends Error {
  readonly status: number;
  /** Concise, user-facing message parsed from the upstream error body, when present. */
  readonly detail?: string;
  /** Verbose/full diagnostic text (e.g. the DIAL envelope's `error.message`), for a hover tooltip. */
  readonly detailFull?: string;

  constructor(status: number, detail?: string, detailFull?: string) {
    super(`Failed to fetch documents: ${status}`);
    this.name = 'UpstreamRequestError';
    this.status = status;
    this.detail = detail;
    this.detailFull = detailFull;
  }
}

/** Returns the first argument that is a non-empty (trimmed) string. */
function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

/**
 * Pulls a user-facing message out of a parsed channel error body. Handles:
 * - the DIAL envelope `{ error: { display_message, message, code } }` — preferring the concise
 *   `display_message` over the verbose diagnostic `message`;
 * - flat `error`/`display_message`/`message`/`detail` strings;
 * - FastAPI-style `detail: [{ msg }]` validation arrays.
 */
function parseErrorDetail(body: unknown): string | undefined {
  if (typeof body === 'string') {
    return body.trim() || undefined;
  }
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const record = body as Record<string, unknown>;

  if (record.error && typeof record.error === 'object') {
    const inner = record.error as Record<string, unknown>;
    const nested = firstString(inner.display_message, inner.message);
    if (nested) {
      return nested;
    }
  }

  const flat = firstString(
    record.error,
    record.display_message,
    record.message,
    record.detail,
  );
  if (flat) {
    return flat;
  }

  if (Array.isArray(record.detail)) {
    const messages = record.detail
      .map((entry) =>
        entry && typeof entry === 'object' && 'msg' in entry
          ? String((entry as { msg: unknown }).msg)
          : '',
      )
      .filter(Boolean);
    if (messages.length > 0) {
      return messages.join('; ');
    }
  }
  return undefined;
}

/**
 * Pulls the verbose/full error text out of a parsed channel error body — the DIAL envelope's
 * `error.message`, which carries the complete diagnostic behind the concise `display_message`.
 * Returns `undefined` when there is no separate verbose text (callers then reuse the concise one).
 */
function parseErrorFull(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (record.error && typeof record.error === 'object') {
      const inner = record.error as Record<string, unknown>;
      return firstString(inner.message, inner.display_message);
    }
  }
  return undefined;
}

/** Builds a DIAL Core deployment channel URL: `/v1/deployments/{id}/route/channel/{segment}`. */
function buildChannelUrl(
  applicationId: string,
  segment: string,
  searchParams?: Record<string, string>,
): string {
  const baseUrl = process.env.DIAL_API_URL;
  if (!baseUrl) {
    throw new Error('DIAL_API_URL is not configured');
  }

  const url = new URL(
    `/v1/deployments/${encodeURIComponent(applicationId)}/route/channel/${segment}`,
    baseUrl,
  );
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function buildDocumentsListUrl(
  applicationId: string,
  offset: number,
  limit: number,
  searchParams?: Record<string, string>,
): string {
  return buildChannelUrl(applicationId, 'documents', {
    offset: String(offset),
    limit: String(limit),
    // Server-side sort/filter params (e.g. `sort`, `order`, per-field filters) forwarded verbatim.
    ...searchParams,
  });
}

export function buildMetadataUrl(applicationId: string): string {
  return buildChannelUrl(applicationId, 'metadata');
}

/**
 * Builds the channel document upload URL, appending the optional `folder` query parameter (the
 * folder where the backend stores the file). Reuses the `documents` segment shared with the list.
 */
export function buildDocumentsUploadUrl(
  applicationId: string,
  folder?: string,
): string {
  return buildChannelUrl(
    applicationId,
    'documents',
    folder ? { folder } : undefined,
  );
}

/**
 * Builds an id-scoped channel document URL: `documents/{id}` plus an optional sub-path
 * (e.g. `reindex`, `download`). The id is encoded here since `buildChannelUrl` inserts the
 * segment raw.
 */
export function buildDocumentUrl(
  applicationId: string,
  id: number,
  subPath?: string,
): string {
  const encodedId = encodeURIComponent(String(id));
  return buildChannelUrl(
    applicationId,
    subPath ? `documents/${encodedId}/${subPath}` : `documents/${encodedId}`,
  );
}

/**
 * Fetches a channel URL with the optional bearer token, throwing {@link UpstreamRequestError} on
 * non-OK and returning the raw {@link Response}. Extra `init` (e.g. `method`/`body`) is merged in;
 * `Content-Type` is left unset so `fetch` derives the multipart boundary when `body` is `FormData`.
 * Use this directly for empty (204) or binary responses; use {@link channelFetch} for JSON.
 */
async function channelRequest(
  url: string,
  accessToken?: string,
  init?: RequestInit,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    // Read the upstream error body once so callers can surface the channel's own message (concise for
    // display, plus the verbose diagnostic for a hover tooltip); a non-JSON/empty body yields neither.
    let detail: string | undefined;
    let detailFull: string | undefined;
    try {
      const body = await response.json();
      detail = parseErrorDetail(body);
      detailFull = parseErrorFull(body);
    } catch {
      detail = undefined;
      detailFull = undefined;
    }
    throw new UpstreamRequestError(response.status, detail, detailFull);
  }

  return response;
}

/** {@link channelRequest} that parses and returns the JSON body as `T`. */
async function channelFetch<T>(
  url: string,
  accessToken?: string,
  init?: RequestInit,
): Promise<T> {
  const response = await channelRequest(url, accessToken, init);
  return (await response.json()) as T;
}

export async function listDocuments(params: {
  applicationId: string;
  offset: number;
  limit: number;
  /** Extra server-side query params (sort/order/filters), forwarded to the channel. */
  searchParams?: Record<string, string>;
  accessToken?: string;
}): Promise<PaginatedDocuments> {
  const { applicationId, offset, limit, searchParams, accessToken } = params;
  const url = buildDocumentsListUrl(applicationId, offset, limit, searchParams);
  channelLogger.debug('fetching documents', {
    applicationId,
    offset,
    limit,
    searchParams,
  });
  return channelFetch<PaginatedDocuments>(url, accessToken);
}

export async function getMetadata(params: {
  applicationId: string;
  accessToken?: string;
}): Promise<ChannelMetadata> {
  const { applicationId, accessToken } = params;
  const url = buildMetadataUrl(applicationId);
  channelLogger.debug('fetching document metadata schema', { applicationId });
  return channelFetch<ChannelMetadata>(url, accessToken);
}

/**
 * Uploads a document to the channel via multipart POST. `formData` must carry the required
 * `attachment` file and may include a `metadata` JSON string (matching the channel's schema).
 * The `Content-Type` header is deliberately left unset so `fetch` derives the multipart boundary.
 */
export async function uploadDocument(params: {
  applicationId: string;
  formData: FormData;
  folder?: string;
  accessToken?: string;
}): Promise<Document> {
  const { applicationId, formData, folder, accessToken } = params;
  const url = buildDocumentsUploadUrl(applicationId, folder);
  channelLogger.debug('uploading document', { applicationId, folder });
  return channelFetch<Document>(url, accessToken, {
    method: 'POST',
    body: formData,
  });
}

/**
 * Imports a previously-exported document bundle via multipart POST — `formData` must carry the
 * `attachment` bundle file. Mirrors {@link uploadDocument} but hits `documents/import` and takes no
 * folder/metadata. Returns the created {@link Document}; the channel replies `422` for an invalid or
 * incompatible bundle (surfaced distinctly by the route).
 */
export async function importDocument(params: {
  applicationId: string;
  formData: FormData;
  accessToken?: string;
}): Promise<Document> {
  const { applicationId, formData, accessToken } = params;
  const url = buildChannelUrl(applicationId, 'documents/import');
  channelLogger.debug('importing document bundle', { applicationId });
  return channelFetch<Document>(url, accessToken, {
    method: 'POST',
    body: formData,
  });
}

/** Deletes a document from the channel. The endpoint responds `204 No Content`, so returns nothing. */
export async function deleteDocument(params: {
  applicationId: string;
  id: number;
  accessToken?: string;
}): Promise<void> {
  const { applicationId, id, accessToken } = params;
  const url = buildDocumentUrl(applicationId, id);
  channelLogger.debug('deleting document', { applicationId, id });
  await channelRequest(url, accessToken, { method: 'DELETE' });
}

/** Reindexes a document (all indexes, no reprocess) and returns its updated state. */
export async function reindexDocument(params: {
  applicationId: string;
  id: number;
  accessToken?: string;
}): Promise<Document> {
  const { applicationId, id, accessToken } = params;
  const url = buildDocumentUrl(applicationId, id, 'reindex');
  channelLogger.debug('reindexing document', { applicationId, id });
  return channelFetch<Document>(url, accessToken, { method: 'PUT' });
}

/** Fetches the original document file as a raw streaming {@link Response} (for proxying a download). */
export async function downloadDocument(params: {
  applicationId: string;
  id: number;
  accessToken?: string;
}): Promise<Response> {
  const { applicationId, id, accessToken } = params;
  const url = buildDocumentUrl(applicationId, id, 'download');
  channelLogger.debug('downloading document', { applicationId, id });
  return channelRequest(url, accessToken);
}

/** Exports a document (content + indexes) as a raw streaming {@link Response} bundle to download. */
export async function exportDocument(params: {
  applicationId: string;
  id: number;
  accessToken?: string;
}): Promise<Response> {
  const { applicationId, id, accessToken } = params;
  const url = buildDocumentUrl(applicationId, id, 'export');
  channelLogger.debug('exporting document', { applicationId, id });
  return channelRequest(url, accessToken);
}
