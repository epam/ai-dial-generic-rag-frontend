import { NextRequest, NextResponse } from 'next/server';

import { CHANNEL_EXPORT_FALLBACK_FILENAME } from '@/constants/channel-export';
import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  downloadChannelExport,
  triggerChannelExport,
} from '@/utils/channel/channel-api';
import {
  channelErrorResponse,
  contentDisposition,
  resolveChannelRequest,
} from '@/utils/channel/route-helpers';

// Streaming a whole-channel archive may exceed the default budget.
export const maxDuration = 45;

/**
 * Starts preparation of the channel export archive. The channel answers `202` and prepares the
 * archive in the background, so this returns the initial status rather than a finished archive —
 * the client polls `GET /api/export/status` from there.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const resolved = resolveChannelRequest(request);
  if (resolved instanceof NextResponse) {
    return resolved;
  }
  const { applicationId } = resolved;

  try {
    const accessToken = await getAccessToken(request);
    const archive = await triggerChannelExport({ applicationId, accessToken });
    return NextResponse.json(archive, { status: 202 });
  } catch (error) {
    return channelErrorResponse(
      error,
      { applicationId, action: 'trigger channel export' },
      'Failed to start the channel export',
    );
  }
}

/**
 * Streams the prepared channel archive to the browser. Only meaningful once the status is `ready`;
 * the channel rejects the request otherwise and this replies `502`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const resolved = resolveChannelRequest(request);
  if (resolved instanceof NextResponse) {
    return resolved;
  }
  const { applicationId } = resolved;
  // Fallback name, used only when the backend's response carries no Content-Disposition.
  const fallbackName =
    request.nextUrl.searchParams.get('filename') ||
    CHANNEL_EXPORT_FALLBACK_FILENAME;

  try {
    const accessToken = await getAccessToken(request);
    const upstream = await downloadChannelExport({
      applicationId,
      accessToken,
    });
    // Prefer the backend's own filename (its Content-Disposition); synthesize one only if absent.
    const disposition =
      upstream.headers.get('content-disposition') ??
      contentDisposition(fallbackName);
    // Stream the upstream archive straight through rather than buffering it.
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/octet-stream',
        'content-disposition': disposition,
      },
    });
  } catch (error) {
    return channelErrorResponse(
      error,
      { applicationId, action: 'download channel export' },
      'Failed to download the channel export archive',
    );
  }
}
