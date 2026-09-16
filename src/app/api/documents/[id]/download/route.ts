import { NextRequest, NextResponse } from 'next/server';

import { getAccessToken } from '@/utils/auth/get-access-token';
import { downloadDocument } from '@/utils/channel/channel-api';
import {
  contentDisposition,
  documentErrorResponse,
  resolveDocumentRequest,
} from '@/utils/channel/route-helpers';

// Streaming a large document may exceed the default budget.
export const maxDuration = 45;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const resolved = await resolveDocumentRequest(request, params);
  if (resolved instanceof NextResponse) {
    return resolved;
  }
  const { applicationId, id } = resolved;
  const filename =
    request.nextUrl.searchParams.get('filename') || `document-${id}`;

  try {
    const accessToken = await getAccessToken(request);
    const upstream = await downloadDocument({ applicationId, id, accessToken });
    // Stream the upstream body straight through rather than buffering the whole file.
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/octet-stream',
        'content-disposition': contentDisposition(filename),
      },
    });
  } catch (error) {
    return documentErrorResponse(
      error,
      { applicationId, id, action: 'download' },
      'Failed to download document',
    );
  }
}
