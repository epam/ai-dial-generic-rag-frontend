import { NextRequest, NextResponse } from 'next/server';

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  importDocument,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { channelLogger } from '@/utils/channel/logger';
import { resolveAttachment } from '@/utils/channel/route-helpers';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const applicationId = searchParams.get('applicationId');

  if (!applicationId) {
    return NextResponse.json(
      { error: 'applicationId query parameter is required' },
      { status: 400 },
    );
  }

  const parsed = await resolveAttachment(request);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  // Forward only the bundle file, so unexpected form parts are not passed upstream.
  const forward = new FormData();
  forward.append('attachment', parsed.attachment, parsed.attachment.name);

  try {
    const accessToken = await getAccessToken(request);
    const document = await importDocument({
      applicationId,
      formData: forward,
      accessToken,
    });
    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    // 422 = the channel rejected the file as an invalid/incompatible bundle. That's a user error,
    // surfaced distinctly so the dialog shows an actionable message instead of a generic failure.
    if (error instanceof UpstreamRequestError && error.status === 422) {
      channelLogger.warn('channel rejected the imported bundle', {
        applicationId,
        status: 422,
      });
      return NextResponse.json(
        { error: 'This file is not a valid or compatible document bundle.' },
        { status: 422 },
      );
    }
    if (error instanceof UpstreamRequestError) {
      channelLogger.warn('channel import API returned a non-OK status', {
        applicationId,
        status: error.status,
      });
    } else {
      channelLogger.error(
        'unexpected error while importing document bundle',
        error,
      );
    }
    return NextResponse.json(
      { error: 'Failed to import document bundle' },
      { status: 502 },
    );
  }
}
