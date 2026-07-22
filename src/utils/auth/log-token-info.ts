import { JWT } from 'next-auth/jwt';

import { createLogger } from '@/utils/logger';

const logger = createLogger('auth');

export const logTokenExpiration = (
  token: JWT | undefined | null,
  logMsg = 'in jwt callback',
): void => {
  const tokenInfo = {
    expiresIn: token?.expires_in,
    expiresAt: token?.expires_at,
    expires: token?.expires_in
      ? Date.now() + (token.expires_in as number) * 1000
      : (token?.expires_at as number) * 1000,
  };

  logger.info(`${logMsg}: ${JSON.stringify(tokenInfo)}`);
};
