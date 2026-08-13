import { NextRequest, NextResponse } from 'next/server';

import { getAccessToken } from '@/utils/auth/get-access-token';
import {
  deleteDocument,
  updateDocument,
  UpstreamRequestError,
} from '@/utils/channel/channel-api';
import { channelLogger } from '@/utils/channel/logger';
import {
  documentErrorResponse,
  resolveDocumentRequest,
} from '@/utils/channel/route-helpers';

/**
 * Updates a document — replaces its content (`attachment`) and/or its `metadata`, both optional.
 * Mirrors the channel's `PUT documents/{id}` multipart contract.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const resolved = await resolveDocumentRequest(request, params);
  if (resolved instanceof NextResponse) {
    return resolved;
  }
  const { applicationId, id } = resolved;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'A valid multipart/form-data body is required' },
      { status: 400 },
    );
  }

  // Forward only the parts the channel accepts; both are optional (edit metadata and/or the file).
  const forward = new FormData();
  const attachment = form.get('attachment');
  if (attachment instanceof File) {
    forward.append('attachment', attachment, attachment.name);
  }
  const metadata = form.get('metadata');
  if (typeof metadata === 'string') {
    forward.append('metadata', metadata);
  }

  try {
    const accessToken = await getAccessToken(request);
    const document = await updateDocument({
      applicationId,
      id,
      formData: forward,
      accessToken,
    });
    return NextResponse.json(document);
  } catch (error) {
    // 422 = the edited metadata doesn't match the channel schema — a user error, surfaced distinctly.
    if (error instanceof UpstreamRequestError && error.status === 422) {
      channelLogger.warn('channel rejected the document update', {
        applicationId,
        id,
        status: 422,
      });
      return NextResponse.json(
        { error: "The metadata doesn't match this channel's schema." },
        { status: 422 },
      );
    }
    return documentErrorResponse(
      error,
      { applicationId, id, action: 'update' },
      'Failed to update document',
    );
  }
}

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
