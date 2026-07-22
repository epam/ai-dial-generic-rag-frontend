import {
  Account,
  AuthOptions,
  CallbacksOptions,
  CookiesOptions,
  Profile,
} from 'next-auth';
import type { TokenSet } from 'openid-client';

import { Token } from '@/lib/auth/types';
import { errorLog, warnLog, errorObjLog } from '@/lib/logger';
import { isDefined } from '@/lib/utility';

import { authProviders } from './auth-providers';
import { logTokenExpiration } from './log-token-info';
import NextClient, { RefreshToken } from './nextauth-client';

declare module 'next-auth' {
  interface Session {
    error?: string;
  }

  interface User {
    isAdmin?: boolean;
  }
}

const waitRefreshTokenTimeout = 5;
const REFRESH_TOKEN_THRESHOLD = 5 * 60 * 1000;
const COOKIE_MAX_AGE = 15 * 60;

const decodeJwtPayload = (jwt: string): Record<string, unknown> => {
  const segment = (jwt.split('.')[1] ?? '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return JSON.parse(Buffer.from(segment, 'base64').toString('utf8'));
};

const readClaim = (payload: Record<string, unknown>, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value == null ? undefined : (value as Record<string, unknown>)[key],
      payload,
    );

const getUser = (accessToken?: string) => {
  const rolesFieldName = process.env.DIAL_ROLES_FIELD ?? 'dial_roles';
  const adminRoleNames = (process.env.ADMIN_ROLE_NAMES || 'admin').split(',');

  let payload: Record<string, unknown> = {};
  if (accessToken) {
    try {
      payload = decodeJwtPayload(accessToken);
    } catch (err) {
      errorObjLog(err, "Token couldn't be parsed as JWT");
    }
  }

  const claim = readClaim(payload, rolesFieldName);
  const roles = Array.isArray(claim)
    ? (claim as string[])
    : claim
      ? [String(claim)]
      : [];

  return { isAdmin: roles.some((role) => adminRoleNames.includes(role)) };
};

async function refreshAccessToken(token: Token) {
  const displayedTokenSub =
    process.env.SHOW_TOKEN_SUB === 'true' ? token.sub : '******';

  try {
    if (!token.providerId) {
      throw new Error('No provider information exists in token');
    }

    const client = NextClient.getClient(token.providerId);
    if (!client) {
      errorLog(
        `No client for provider: ${token.providerId}. Sub: ${displayedTokenSub}. Token refresh failed for ${token.userId}`,
      );
      return { ...token, error: 'NoClientForProvider' };
    }

    let msWaiting = 0;
    while (true) {
      const refresh = NextClient.getRefreshToken(token.userId);
      if (!refresh || !refresh.isRefreshing) {
        const localToken: RefreshToken = refresh || {
          isRefreshing: true,
          token,
        };
        if (
          typeof localToken.token?.accessTokenExpires === 'number' &&
          Date.now() <
            localToken.token.accessTokenExpires - REFRESH_TOKEN_THRESHOLD
        ) {
          return localToken.token;
        }
        NextClient.setIsRefreshTokenStart(token.userId, localToken);
        break;
      }

      await NextClient.delay();
      msWaiting += 50;
      if (msWaiting >= waitRefreshTokenTimeout * 1000) {
        throw new Error(
          `Waiting more than ${waitRefreshTokenTimeout} seconds for refreshing token`,
        );
      }
    }

    const refreshedTokens = await client.refresh(
      token.refreshToken as string | TokenSet,
    );
    if (
      !refreshedTokens ||
      (!refreshedTokens.expires_in && !refreshedTokens.expires_at)
    ) {
      throw new Error('Error from auth provider while refreshing token');
    }
    if (!refreshedTokens.refresh_token) {
      warnLog(
        `Auth provider didn't provide new refresh token. Sub: ${displayedTokenSub}`,
      );
    }
    if (!refreshedTokens.refresh_token && !token.refreshToken) {
      throw new Error('No refresh tokens exists');
    }

    logTokenExpiration(refreshedTokens, 'in refreshAccessToken callback');
    const returnToken = {
      ...token,
      user: getUser(refreshedTokens.access_token),
      access_token: refreshedTokens.access_token,
      accessTokenExpires: refreshedTokens.expires_in
        ? Date.now() + refreshedTokens.expires_in * 1000
        : (refreshedTokens.expires_at as number) * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
    NextClient.setIsRefreshTokenStart(token.userId, {
      isRefreshing: false,
      token: returnToken,
    });
    return returnToken;
  } catch (error: unknown) {
    errorObjLog(
      error,
      `Error when refreshing token: ${(error as Error).message}. Sub: ${displayedTokenSub}`,
    );
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

function defaultCookies(
  useSecureCookies: boolean,
  sameSite = 'lax',
): CookiesOptions {
  const cookiePrefix = useSecureCookies ? '__Secure-' : '';
  return {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: `${useSecureCookies ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies,
      },
    },
    pkceCodeVerifier: {
      name: `${cookiePrefix}next-auth.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies,
        maxAge: COOKIE_MAX_AGE,
      },
    },
    state: {
      name: `${cookiePrefix}next-auth.state`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies,
        maxAge: COOKIE_MAX_AGE,
      },
    },
    nonce: {
      name: `${cookiePrefix}next-auth.nonce`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies,
      },
    },
  };
}

const isSecure =
  !!process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.startsWith('https:');

export const callbacks: Partial<
  CallbacksOptions<Profile & { job_title?: string }, Account>
> = {
  jwt: async (options) => {
    if (options.account) {
      return {
        ...options.token,
        user: getUser(options.account?.access_token),
        jobTitle: options.profile?.job_title,
        access_token: options.account.access_token,
        accessTokenExpires:
          typeof options.account.expires_in === 'number'
            ? Date.now() + options.account.expires_in * 1000
            : (options.account.expires_at as number) * 1000,
        refreshToken: options.account.refresh_token,
        providerId: options.account.provider,
        userId: options.user.id,
        idToken: options.account.id_token,
      };
    }

    const timeLeft =
      typeof options.token.accessTokenExpires === 'number' &&
      options.token.accessTokenExpires - Date.now();

    if (timeLeft && timeLeft > REFRESH_TOKEN_THRESHOLD) {
      return {
        ...options.token,
        user: getUser(
          typeof options.token.access_token === 'string'
            ? options.token.access_token
            : undefined,
        ),
      };
    }

    const refreshedToken = await refreshAccessToken(options.token as Token);
    if ((refreshedToken as { error?: string }).error) {
      errorObjLog(
        (refreshedToken as { error?: string }).error,
        'Error during token refresh',
      );
    }
    return refreshedToken;
  },
  signIn: async (options) => isDefined(options.account?.access_token),
  session: async (options) => {
    if (options.token?.error) {
      (options.session as { error: unknown }).error = options.token.error;
    }
    return options.session;
  },
};

export const nextauthOptions: AuthOptions = {
  providers: authProviders,
  cookies: defaultCookies(isSecure, isSecure ? 'none' : 'lax'),
  callbacks,
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
};
