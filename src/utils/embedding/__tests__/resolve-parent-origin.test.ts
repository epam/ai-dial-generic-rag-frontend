import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveParentOrigin } from '@/utils/embedding/resolve-parent-origin';

function setAncestorOrigins(origins: string[] | undefined) {
  Object.defineProperty(window.location, 'ancestorOrigins', {
    value: origins,
    configurable: true,
  });
}

function setReferrer(referrer: string) {
  Object.defineProperty(document, 'referrer', {
    value: referrer,
    configurable: true,
  });
}

describe('resolveParentOrigin', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setAncestorOrigins(undefined);
    setReferrer('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers ancestorOrigins when present', () => {
    setAncestorOrigins(['https://admin.example.com']);
    setReferrer('https://ignored.example.com');

    expect(resolveParentOrigin('https://also-ignored.example.com')).toBe(
      'https://admin.example.com',
    );
  });

  it('falls back to document.referrer when ancestorOrigins is absent', () => {
    setReferrer('https://admin.example.com/some/path');
    expect(resolveParentOrigin()).toBe('https://admin.example.com');
  });

  it('falls back to the fallback origin when the referrer is malformed', () => {
    setReferrer('not a url');

    expect(resolveParentOrigin('https://admin.example.com')).toBe(
      'https://admin.example.com',
    );
  });

  it('falls back to the fallback origin when neither ancestorOrigins nor referrer are available', () => {
    expect(resolveParentOrigin('https://admin.example.com')).toBe(
      'https://admin.example.com',
    );
  });

  it('returns undefined when nothing resolves', () => {
    expect(resolveParentOrigin()).toBeUndefined();
  });
});
