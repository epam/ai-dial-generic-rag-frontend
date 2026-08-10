const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a `format: "date"`/`"date-time"` schema string into a `Date` for the ui-kit's `Calendar`
 * component. Date-only values are built from their year/month/day components rather than passed
 * to `new Date(str)`, which parses them as UTC midnight and can render as the previous day in
 * timezones behind UTC.
 */
export function parseDateFieldValue(
  value: unknown,
  format: string | undefined,
): Date | null {
  if (typeof value !== 'string' || value === '') {
    return null;
  }

  if (format === 'date-time') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  const parsed = new Date(year, month, day);

  const isValid =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month &&
    parsed.getDate() === day;
  return isValid ? parsed : null;
}

/**
 * Formats a `Calendar` value back into the `format: "date"`/`"date-time"` schema string. Date-only
 * values are built from the `Date`'s local calendar components (not `toISOString`), so the result
 * matches the calendar day the user selected regardless of the viewer's timezone.
 */
export function formatDateFieldValue(
  value: Date | string | null | undefined,
  format: string | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (format === 'date-time') {
    return value.toISOString();
  }

  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
