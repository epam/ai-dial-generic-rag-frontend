import { NextRequest, NextResponse } from 'next/server';

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  listDocuments,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { channelLogger } from '@/utils/channel/logger';

const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 25;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const applicationId = searchParams.get('applicationId');

  if (!applicationId) {
    return NextResponse.json(
      { error: 'applicationId query parameter is required' },
      { status: 400 },
    );
  }

  const offset = Number(searchParams.get('offset') ?? DEFAULT_OFFSET);
  const limit = Number(searchParams.get('limit') ?? DEFAULT_LIMIT);

  try {
    const accessToken = await getAccessToken(request);
    const documents = await listDocuments({
      applicationId,
      offset,
      limit,
      accessToken,
    });
    return NextResponse.json(documents);
  } catch (error) {
    if (error instanceof UpstreamRequestError) {
      channelLogger.warn('channel API returned a non-OK status', {
        applicationId,
        offset,
        limit,
        status: error.status,
      });
    } else {
      channelLogger.error('unexpected error while listing documents', error);
    }
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 502 },
    );
  }
}
