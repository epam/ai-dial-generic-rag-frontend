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
    if (error instanceof UpstreamRequestError) {
      channelLogger.warn('channel import API returned a non-OK status', {
        applicationId,
        status: error.status,
      });
      // Surface the channel's own message for every status except a 500 (its message is
      // user-actionable, e.g. a schema mismatch); a 500 stays generic so server internals don't leak.
      if (error.status !== 500) {
        return NextResponse.json(
          {
            error: error.detail ?? 'Failed to import the document bundle.',
            // Verbose diagnostic for the dialog's hover tooltip; omitted (undefined) when absent.
            errorDetail: error.detailFull,
          },
          { status: error.status },
        );
      }
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
