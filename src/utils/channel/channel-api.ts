import type { PaginatedDocuments } from '@/types/documents';
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

export function buildDocumentsListUrl(
  applicationId: string,
  offset: number,
  limit: number,
): string {
  const baseUrl = process.env.DIAL_CORE_URL;
  if (!baseUrl) {
    throw new Error('DIAL_CORE_URL is not configured');
  }

  const url = new URL(
    `/v1/deployments/${encodeURIComponent(applicationId)}/route/channel/documents`,
    baseUrl,
  );
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', String(limit));
  return url.toString();
}

export async function listDocuments(params: {
  applicationId: string;
  offset: number;
  limit: number;
  accessToken?: string;
}): Promise<PaginatedDocuments> {
  const { applicationId, offset, limit, accessToken } = params;
  const url = buildDocumentsListUrl(applicationId, offset, limit);
  const headers: Record<string, string> = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};

  channelLogger.debug('fetching documents', { applicationId, offset, limit });

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new UpstreamRequestError(response.status);
  }

  return (await response.json()) as PaginatedDocuments;
}
