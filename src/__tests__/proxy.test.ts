import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { proxy } from '@/proxy';

const requestFor = (path: string) =>
  new NextRequest(new URL(`http://localhost:4600${path}`));

describe('proxy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults frame-ancestors to 'none' when ALLOWED_FRAME_ANCESTORS is unset", () => {
    vi.stubEnv('ALLOWED_FRAME_ANCESTORS', '');
    const response = proxy(requestFor('/en'));
    expect(response.headers.get('Content-Security-Policy')).toBe(
      "frame-ancestors 'none'",
    );
  });

  it('uses ALLOWED_FRAME_ANCESTORS when set', () => {
    vi.stubEnv('ALLOWED_FRAME_ANCESTORS', 'https://admin.example.com');
    const response = proxy(requestFor('/en'));
    expect(response.headers.get('Content-Security-Policy')).toBe(
      'frame-ancestors https://admin.example.com',
    );
  });

  it('redirects the root path to the default locale', () => {
    const response = proxy(requestFor('/'));
    expect(response.headers.get('location')).toContain('/en');
  });
});
