import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxy } from '@/proxy';

describe('proxy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults frame-ancestors to 'none' when ALLOWED_FRAME_ANCESTORS is unset", () => {
    vi.stubEnv('ALLOWED_FRAME_ANCESTORS', '');
    const response = proxy();
    expect(response.headers.get('Content-Security-Policy')).toBe(
      "frame-ancestors 'none'",
    );
  });

  it('uses ALLOWED_FRAME_ANCESTORS when set', () => {
    vi.stubEnv('ALLOWED_FRAME_ANCESTORS', 'https://admin.example.com');
    const response = proxy();
    expect(response.headers.get('Content-Security-Policy')).toBe(
      'frame-ancestors https://admin.example.com',
    );
  });
});
