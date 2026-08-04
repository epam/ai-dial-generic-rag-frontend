import { NextRequest, NextResponse } from 'next/server';

import { getAccessToken } from '@/utils/auth/get-access-token';
import { reindexDocument } from '@/utils/channel/channel-api';
import {
  documentErrorResponse,
  resolveDocumentRequest,
} from '@/utils/channel/route-helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const resolved = await resolveDocumentRequest(request, params);
  if (resolved instanceof NextResponse) {
    return resolved;
  }
  const { applicationId, id } = resolved;

  try {
    const accessToken = await getAccessToken(request);
    const document = await reindexDocument({ applicationId, id, accessToken });
    return NextResponse.json(document);
  } catch (error) {
    return documentErrorResponse(
      error,
      { applicationId, id, action: 'reindex' },
      'Failed to reindex document',
    );
  }
}
