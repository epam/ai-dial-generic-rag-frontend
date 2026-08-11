import { NextRequest, NextResponse } from 'next/server';

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  listDocuments,
  uploadDocument,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { channelLogger } from '@/utils/channel/logger';
import { resolveAttachment } from '@/utils/channel/route-helpers';

const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 25;

// Query params the GET handler consumes itself; everything else is forwarded to the channel as
// server-side sort/filter params.
const RESERVED_LIST_PARAMS = new Set(['applicationId', 'offset', 'limit']);

// Document uploads can take a while to stream to DIAL Core, so allow more than the default budget.
export const maxDuration = 45;

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

  // Pass any sort/filter params straight through to the channel.
  const forwardedParams: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (!RESERVED_LIST_PARAMS.has(key)) {
      forwardedParams[key] = value;
    }
  }

  try {
    const accessToken = await getAccessToken(request);
    const documents = await listDocuments({
      applicationId,
      offset,
      limit,
      searchParams: forwardedParams,
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const applicationId = searchParams.get('applicationId');
  const folder = searchParams.get('folder') ?? undefined;

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
  const { form, attachment } = parsed;
  const rawMetadata = form.get('metadata');
  const metadata = typeof rawMetadata === 'string' ? rawMetadata : null;

  // Forward only the fields the channel accepts, so unexpected form parts are not passed upstream.
  const forward = new FormData();
  forward.append('attachment', attachment, attachment.name);
  if (metadata !== null) {
    forward.append('metadata', metadata);
  }

  try {
    const accessToken = await getAccessToken(request);
    const document = await uploadDocument({
      applicationId,
      folder,
      formData: forward,
      accessToken,
    });
    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    if (error instanceof UpstreamRequestError) {
      channelLogger.warn('channel upload API returned a non-OK status', {
        applicationId,
        folder,
        status: error.status,
      });
    } else {
      channelLogger.error('unexpected error while uploading document', error);
    }
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 502 },
    );
  }
}
