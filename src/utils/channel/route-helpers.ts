import { NextRequest, NextResponse } from 'next/server';

import { UpstreamRequestError } from '@/utils/channel/channel-api';
import { channelLogger } from '@/utils/channel/logger';

/** The resolved input shared by every channel-scoped route handler. */
export interface ChannelRouteInput {
  applicationId: string;
}

/** The resolved inputs shared by every id-scoped document route handler. */
export interface DocumentRouteInput extends ChannelRouteInput {
  id: number;
}

/**
 * Resolves the `applicationId` query param required by every channel route (it selects the DIAL
 * deployment the channel lives behind), or returns a `400` response when it is missing. Callers do:
 * `const resolved = resolveChannelRequest(request); if (resolved instanceof NextResponse) return resolved;`
 */
export function resolveChannelRequest(
  request: NextRequest,
): ChannelRouteInput | NextResponse {
  const applicationId = request.nextUrl.searchParams.get('applicationId');
  if (!applicationId) {
    return NextResponse.json(
      { error: 'applicationId query parameter is required' },
      { status: 400 },
    );
  }
  return { applicationId };
}

/**
 * Resolves the `applicationId` query param and the `{id}` path param shared by the id-scoped
 * document routes, or returns a `400` response when either is missing/invalid. Callers do:
 * `const resolved = await resolveDocumentRequest(...); if (resolved instanceof NextResponse) return resolved;`
 */
export async function resolveDocumentRequest(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<DocumentRouteInput | NextResponse> {
  const applicationId = request.nextUrl.searchParams.get('applicationId');
  const id = Number((await params).id);

  if (!applicationId) {
    return NextResponse.json(
      { error: 'applicationId query parameter is required' },
      { status: 400 },
    );
  }
  if (!Number.isInteger(id)) {
    return NextResponse.json(
      { error: 'A numeric document id is required' },
      { status: 400 },
    );
  }
  return { applicationId, id };
}

/**
 * Parses a multipart request body and returns its required `attachment` file (plus the full `form`
 * for any additional parts a caller needs), or a `400` response when the body isn't valid multipart
 * or the `attachment` is missing. Callers do:
 * `const parsed = await resolveAttachment(request); if (parsed instanceof NextResponse) return parsed;`
 */
export async function resolveAttachment(
  request: NextRequest,
): Promise<{ form: FormData; attachment: File } | NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'A valid multipart/form-data body is required' },
      { status: 400 },
    );
  }

  const attachment = form.get('attachment');
  if (!(attachment instanceof File)) {
    return NextResponse.json(
      { error: 'attachment file is required' },
      { status: 400 },
    );
  }
  return { form, attachment };
}

/**
 * Maps a channel failure to a `502` response, logging {@link UpstreamRequestError} at `warn`
 * (an anticipated upstream status) and anything else at `error`. `action` names the operation for
 * the log message (e.g. `'delete'`); `id` is included only for document-scoped routes.
 */
export function channelErrorResponse(
  error: unknown,
  context: ChannelRouteInput & { action: string; id?: number },
  message: string,
): NextResponse {
  const { applicationId, id, action } = context;
  if (error instanceof UpstreamRequestError) {
    channelLogger.warn(`channel ${action} API returned a non-OK status`, {
      applicationId,
      ...(id === undefined ? {} : { id }),
      status: error.status,
    });
  } else {
    channelLogger.error(`unexpected error while running ${action}`, error);
  }
  return NextResponse.json({ error: message }, { status: 502 });
}

/** {@link channelErrorResponse} for the document-scoped routes, which always have an `id`. */
export function documentErrorResponse(
  error: unknown,
  context: DocumentRouteInput & { action: string },
  message: string,
): NextResponse {
  return channelErrorResponse(error, context, message);
}

/**
 * Builds a `Content-Disposition` value safe from header injection, keeping unicode via `filename*`.
 * Used by every route that streams a file back to the browser, as the fallback for when the
 * upstream response carries no such header of its own.
 */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/["\\\r\n]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
