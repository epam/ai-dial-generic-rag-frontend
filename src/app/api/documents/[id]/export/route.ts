import { NextRequest, NextResponse } from 'next/server';

import { getAccessToken } from '@/utils/auth/get-access-token';
import { exportDocument } from '@/utils/channel/channel-api';
import {
  documentErrorResponse,
  resolveDocumentRequest,
} from '@/utils/channel/route-helpers';

/** Builds a `Content-Disposition` value safe from header injection, keeping unicode via `filename*`. */
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/["\\\r\n]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const resolved = await resolveDocumentRequest(request, params);
  if (resolved instanceof NextResponse) {
    return resolved;
  }
  const { applicationId, id } = resolved;
  // Fallback name, used only when the backend's response carries no Content-Disposition.
  const fallbackName =
    request.nextUrl.searchParams.get('filename') || `document-${id}.bundle`;

  try {
    const accessToken = await getAccessToken(request);
    const upstream = await exportDocument({ applicationId, id, accessToken });
    // Prefer the backend's own filename (its Content-Disposition); synthesize one only if absent.
    const disposition =
      upstream.headers.get('content-disposition') ??
      contentDisposition(fallbackName);
    // Stream the upstream bundle straight through rather than buffering it.
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/octet-stream',
        'content-disposition': disposition,
      },
    });
  } catch (error) {
    return documentErrorResponse(
      error,
      { applicationId, id, action: 'export' },
      'Failed to export document',
    );
  }
}
