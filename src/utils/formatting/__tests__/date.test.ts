import { describe, expect, it } from 'vitest';

import {
  formatDateTimeToLocalString,
  formatDateToLocalString,
} from '@/utils/formatting/date';

describe('formatDateTimeToLocalString', () => {
  it('returns an empty string for missing values', () => {
    expect(formatDateTimeToLocalString()).toBe('');
    expect(formatDateTimeToLocalString(null)).toBe('');
    expect(formatDateTimeToLocalString(undefined)).toBe('');
    expect(formatDateTimeToLocalString('')).toBe('');
  });

  it('formats an ISO datetime string in the viewer locale (date and time)', () => {
    expect(formatDateTimeToLocalString('2024-01-15T10:30:00Z')).toBe(
      new Date('2024-01-15T10:30:00Z').toLocaleString(),
    );
  });

  it('treats a numeric string as a millisecond timestamp, not a date string', () => {
    const ms = Date.UTC(2024, 0, 15, 10, 30);
    expect(formatDateTimeToLocalString(String(ms))).toBe(
      new Date(ms).toLocaleString(),
    );
  });

  it('falls back to the raw value when it cannot be parsed', () => {
    expect(formatDateTimeToLocalString('not-a-date')).toBe('not-a-date');
  });
});

describe('formatDateToLocalString', () => {
  it('returns an empty string for missing values', () => {
    expect(formatDateToLocalString()).toBe('');
    expect(formatDateToLocalString(null)).toBe('');
  });

  it('formats a date without the time component', () => {
    expect(formatDateToLocalString('2024-01-15')).toBe(
      new Date('2024-01-15').toLocaleDateString(),
    );
  });

  it('falls back to the raw value when it cannot be parsed', () => {
    expect(formatDateToLocalString('not-a-date')).toBe('not-a-date');
  });
});
