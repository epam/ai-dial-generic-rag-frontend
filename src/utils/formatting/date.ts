/**
 * Date formatting helpers, mirroring the DIAL Admin frontend
 * (`apps/ai-dial-admin/src/utils/formatting/date.ts`): parse a millisecond timestamp or ISO string
 * and render it in the viewer's locale. The grid date columns use these the same way DIAL Admin's
 * `dateTimeColumn` config does.
 */

/**
 * Normalize a datetime value into a `Date`. Numeric strings (millisecond timestamps serialized as
 * strings) are converted to numbers so they aren't misparsed as date strings.
 */
function toDate(value: number | string): Date {
  const normalized =
    typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))
      ? Number(value)
      : value;

  return new Date(normalized);
}

/** Format a datetime (ms timestamp or ISO string) as a locale date-time string, e.g. `7/30/2026, 3:12:00 PM`. */
export function formatDateTimeToLocalString(
  value?: number | string | null,
): string {
  if (!value) {
    return '';
  }

  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

/** Format a date (ms timestamp or ISO string) as a locale date string, e.g. `7/30/2026`. */
export function formatDateToLocalString(
  value?: number | string | null,
): string {
  if (!value) {
    return '';
  }

  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}
