import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { getIsEnableAuthToggle } from '@/utils/auth/get-auth-toggle';
import { authLogger } from '@/utils/auth/logger';

export async function getAccessToken(
  request: NextRequest,
): Promise<string | undefined> {
  if (!getIsEnableAuthToggle()) {
    return undefined;
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token || typeof token.access_token !== 'string') {
    authLogger.warn('no access token found on session');
    return undefined;
  }

  return token.access_token;
}
