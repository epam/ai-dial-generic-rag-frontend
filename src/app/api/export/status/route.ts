import { NextRequest, NextResponse } from 'next/server';

import { getAccessToken } from '@/utils/auth/get-access-token';
import { getChannelExportStatus } from '@/utils/channel/channel-api';
import {
  channelErrorResponse,
  resolveChannelRequest,
} from '@/utils/channel/route-helpers';

/**
 * Reports the state of the channel export archive, so the client knows which action to offer:
 * prepare (`not_found`), wait (`pending`), download (`ready`), or retry (`error`). All four are
 * normal `200` bodies passed straight through — only a transport/upstream failure yields `502`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const resolved = resolveChannelRequest(request);
  if (resolved instanceof NextResponse) {
    return resolved;
  }
  const { applicationId } = resolved;

  try {
    const accessToken = await getAccessToken(request);
    const archive = await getChannelExportStatus({
      applicationId,
      accessToken,
    });
    return NextResponse.json(archive);
  } catch (error) {
    return channelErrorResponse(
      error,
      { applicationId, action: 'channel export status' },
      'Failed to read the channel export status',
    );
  }
}
