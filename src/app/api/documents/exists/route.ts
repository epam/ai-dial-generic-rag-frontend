import { NextRequest, NextResponse } from 'next/server';

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  documentExists,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { channelLogger } from '@/utils/channel/logger';

/**
 * Checks whether a document already exists at a given path (`filename` + optional `folder`), so the
 * Add-document form can flag a conflicting upload before it is submitted. Proxies the channel's
 * `GET documents/exists` and returns `{ exists: boolean }`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const applicationId = searchParams.get('applicationId');
  const filename = searchParams.get('filename');

  if (!applicationId) {
    return NextResponse.json(
      { error: 'applicationId query parameter is required' },
      { status: 400 },
    );
  }
  if (!filename) {
    return NextResponse.json(
      { error: 'filename query parameter is required' },
      { status: 400 },
    );
  }
  // Treat an empty `folder` as absent so the channel applies its own default folder.
  const folder = searchParams.get('folder') || undefined;

  try {
    const accessToken = await getAccessToken(request);
    const exists = await documentExists({
      applicationId,
      filename,
      folder,
      accessToken,
    });
    return NextResponse.json({ exists });
  } catch (error) {
    if (error instanceof UpstreamRequestError) {
      channelLogger.warn('channel exists API returned a non-OK status', {
        applicationId,
        status: error.status,
      });
    } else {
      channelLogger.error(
        'unexpected error while checking document existence',
        error,
      );
    }
    return NextResponse.json(
      { error: 'Failed to check document existence' },
      { status: 502 },
    );
  }
}
