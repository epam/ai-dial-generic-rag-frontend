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

  constructor(status: number) {
    super(`Failed to fetch documents: ${status}`);
    this.name = 'UpstreamRequestError';
    this.status = status;
  }
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
 * Fetches a channel URL with the optional bearer token, throwing {@link UpstreamRequestError} on
 * non-OK and parsing the JSON body. Extra `init` (e.g. `method`/`body` for uploads) is merged in;
 * `Content-Type` is left unset so `fetch` derives the multipart boundary when `body` is `FormData`.
 */
async function channelFetch<T>(
  url: string,
  accessToken?: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    throw new UpstreamRequestError(response.status);
  }

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
