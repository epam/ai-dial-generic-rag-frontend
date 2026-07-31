import type { ColDef, ValueGetterParams } from 'ag-grid-community';

import type { Document } from '@/types/documents';
import type {
  DocumentMetadataSchema,
  MetadataProperty,
} from '@/types/metadata';
import {
  formatDateTimeToLocalString,
  formatDateToLocalString,
} from '@/utils/formatting/date';

/**
 * JSON Schema types whose values render cleanly as a single grid cell. Dates are `type: "string"`
 * with `format: "date"`, so they're already covered by `"string"`; `"date"` is included in case a
 * schema ever models them as a first-class type.
 */
const DISPLAYABLE_TYPES = new Set(['string', 'date']);

/** JSON Schema `format` values that mark a string property as a date. */
const DATE_FORMATS = new Set(['date', 'date-time']);

function propertyTypes(property: MetadataProperty): string[] {
  const { type } = property;
  if (Array.isArray(type)) {
    return type.filter((entry): entry is string => typeof entry === 'string');
  }
  return typeof type === 'string' ? [type] : [];
}

/** Whether a property holds a date — either a first-class `date` type or a date-formatted string. */
export function isDateProperty(property: MetadataProperty): boolean {
  if (propertyTypes(property).includes('date')) {
    return true;
  }
  return (
    typeof property.format === 'string' && DATE_FORMATS.has(property.format)
  );
}

/**
 * Locale formatter for a date property. `format: "date-time"` keeps the time component
 * (`toLocaleString`); a plain date shows the day only (`toLocaleDateString`), so a date-only value
 * doesn't render a spurious `12:00:00 AM`.
 */
export function formatDatePropertyValue(
  property: MetadataProperty,
  value: unknown,
): string {
  const format =
    property.format === 'date-time'
      ? formatDateTimeToLocalString
      : formatDateToLocalString;
  return format(value as number | string | null | undefined);
}

/**
 * A metadata property becomes a documents-grid column only if it opts into filtering
 * (`enable_filtering === true`) and is a string- or date-typed scalar. Array/object properties
 * (e.g. a list of topics) are excluded even when filterable, since they don't render as one cell.
 */
export function isDisplayableProperty(property: MetadataProperty): boolean {
  if (property.enable_filtering !== true) {
    return false;
  }
  return propertyTypes(property).some((type) => DISPLAYABLE_TYPES.has(type));
}

/**
 * Turns a snake/kebab-case metadata key into a human column header,
 * e.g. `publication_type` → `Publication Type`.
 */
export function humanizePropertyKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Builds the dynamic documents-grid columns from the channel metadata schema: one column per
 * filterable string/date property, reading its value from the document's `metadata` map. Property
 * order follows the schema's declaration order.
 */
export function buildMetadataColumns(
  schema: DocumentMetadataSchema | undefined,
): ColDef<Document>[] {
  const properties = schema?.properties;
  if (!properties) {
    return [];
  }

  return Object.entries(properties)
    .filter(([, property]) => isDisplayableProperty(property))
    .map(([key, property]) => {
      const isDate = isDateProperty(property);

      // Formatting happens in the valueGetter, not valueFormatter: DialGrid renders each cell with
      // its own renderer that prints String(params.value) and ignores valueFormatter entirely.
      return {
        colId: key,
        headerName: humanizePropertyKey(key),
        valueGetter: (params: ValueGetterParams<Document>) => {
          const raw = params.data?.metadata?.[key];
          return isDate ? formatDatePropertyValue(property, raw) : raw;
        },
        flex: 1,
      };
    });
}
