import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  formatDateFieldValue,
  parseDateFieldValue,
} from '@/utils/documents/date-field';

describe('parseDateFieldValue', () => {
  it('returns null for missing values', () => {
    expect(parseDateFieldValue(null, 'date')).toBeNull();
    expect(parseDateFieldValue(undefined, 'date')).toBeNull();
    expect(parseDateFieldValue('', 'date')).toBeNull();
  });

  it('returns null for non-string values', () => {
    expect(parseDateFieldValue(42, 'date')).toBeNull();
  });

  it('parses a date-only string as calendar components, not a UTC instant', () => {
    // A timezone behind UTC is exactly where `new Date("2026-08-07")` (parsed as UTC
    // midnight) would display as 2026-08-06 locally — this pins that bug down.
    const original = process.env.TZ;
    process.env.TZ = 'Pacific/Kiritimati'; // UTC+14, the furthest-ahead timezone

    try {
      const result = parseDateFieldValue('2026-08-07', 'date');
      expect(result).not.toBeNull();
      expect(result?.getFullYear()).toBe(2026);
      expect(result?.getMonth()).toBe(7); // 0-indexed: August
      expect(result?.getDate()).toBe(7);
    } finally {
      process.env.TZ = original;
    }
  });

  it('returns null for a malformed date-only string', () => {
    expect(parseDateFieldValue('not-a-date', 'date')).toBeNull();
    expect(parseDateFieldValue('2026-13-40', 'date')).toBeNull();
  });

  it('parses a date-time string as an absolute instant', () => {
    const result = parseDateFieldValue('2026-08-07T10:30:00Z', 'date-time');
    expect(result?.getTime()).toBe(new Date('2026-08-07T10:30:00Z').getTime());
  });

  it('returns null for a malformed date-time string', () => {
    expect(parseDateFieldValue('not-a-date', 'date-time')).toBeNull();
  });
});

describe('formatDateFieldValue', () => {
  let originalTZ: string | undefined;

  beforeEach(() => {
    originalTZ = process.env.TZ;
  });

  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  it('returns null for a null value', () => {
    expect(formatDateFieldValue(null, 'date')).toBeNull();
  });

  it('formats a Date as YYYY-MM-DD from local calendar components', () => {
    process.env.TZ = 'Pacific/Kiritimati';
    expect(formatDateFieldValue(new Date(2026, 7, 7), 'date')).toBe(
      '2026-08-07',
    );
  });

  it('zero-pads single-digit month and day', () => {
    expect(formatDateFieldValue(new Date(2026, 0, 5), 'date')).toBe(
      '2026-01-05',
    );
  });

  it('formats a Date as a full ISO date-time string', () => {
    const date = new Date('2026-08-07T10:30:00Z');
    expect(formatDateFieldValue(date, 'date-time')).toBe(date.toISOString());
  });

  it('round-trips a date-only value regardless of timezone', () => {
    process.env.TZ = 'Pacific/Kiritimati';
    const parsed = parseDateFieldValue('2026-08-07', 'date');
    expect(formatDateFieldValue(parsed, 'date')).toBe('2026-08-07');
  });
});
