import { NextRequest, NextResponse } from 'next/server';

import { getAccessToken } from '@/utils/auth/get-access-token';
import { getMetadata, UpstreamRequestError } from '@/utils/channel/channel-api';
import { channelLogger } from '@/utils/channel/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const applicationId = searchParams.get('applicationId');

  if (!applicationId) {
    return NextResponse.json(
      { error: 'applicationId query parameter is required' },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getAccessToken(request);
    const metadata = await getMetadata({ applicationId, accessToken });
    return NextResponse.json(metadata);
  } catch (error) {
    if (error instanceof UpstreamRequestError) {
      channelLogger.warn('channel metadata API returned a non-OK status', {
        applicationId,
        status: error.status,
      });
    } else {
      channelLogger.error(
        'unexpected error while fetching document metadata',
        error,
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch document metadata' },
      { status: 502 },
    );
  }
}
