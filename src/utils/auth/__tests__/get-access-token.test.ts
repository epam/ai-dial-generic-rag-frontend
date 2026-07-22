import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

import { getToken } from 'next-auth/jwt';
import { getAccessToken } from '@/utils/auth/get-access-token';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/documents');
}

describe('getAccessToken', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.mocked(getToken).mockReset();
  });

  it('returns undefined when auth is disabled (no NEXTAUTH_URL)', async () => {
    vi.stubEnv('NEXTAUTH_URL', '');
    const result = await getAccessToken(makeRequest());
    expect(result).toBeUndefined();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('returns the access_token from the session token when auth is enabled', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://app.example.com');
    vi.mocked(getToken).mockResolvedValue({ access_token: 'token-123' });

    const result = await getAccessToken(makeRequest());

    expect(result).toBe('token-123');
  });

  it('returns undefined when the session token has no access_token', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://app.example.com');
    vi.mocked(getToken).mockResolvedValue({});

    const result = await getAccessToken(makeRequest());

    expect(result).toBeUndefined();
  });

  it('returns undefined when there is no session token at all', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://app.example.com');
    vi.mocked(getToken).mockResolvedValue(null);

    const result = await getAccessToken(makeRequest());

    expect(result).toBeUndefined();
  });
});
