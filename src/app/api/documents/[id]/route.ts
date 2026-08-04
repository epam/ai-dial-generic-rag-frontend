import { NextRequest, NextResponse } from 'next/server';

import { getAccessToken } from '@/utils/auth/get-access-token';
import { deleteDocument } from '@/utils/channel/channel-api';
import {
  documentErrorResponse,
  resolveDocumentRequest,
} from '@/utils/channel/route-helpers';

export async function DELETE(
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
    await deleteDocument({ applicationId, id, accessToken });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return documentErrorResponse(
      error,
      { applicationId, id, action: 'delete' },
      'Failed to delete document',
    );
  }
}
