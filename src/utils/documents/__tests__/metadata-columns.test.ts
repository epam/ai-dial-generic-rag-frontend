import type { ValueGetterParams } from 'ag-grid-community';
import { describe, expect, it } from 'vitest';

import type { Document } from '@/types/documents';
import type { DocumentMetadataSchema } from '@/types/metadata';
import {
  buildMetadataColumns,
  formatDatePropertyValue,
  humanizePropertyKey,
  isDateProperty,
  isDisplayableProperty,
} from '@/utils/documents/metadata-columns';

// Mirrors the `schema` object returned by the channel `metadata` endpoint.
const SAMPLE_SCHEMA: DocumentMetadataSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'DocumentMetadataSchema',
  type: 'object',
  properties: {
    publication_type: {
      type: 'string',
      enable_filtering: true,
      enable_in_mcp_retrieve_chunks: true,
    },
    publication_date: {
      type: 'string',
      format: 'date',
      enable_filtering: true,
      enable_in_mcp_retrieve_chunks: true,
    },
    publication_title: { type: 'string', enable_in_mcp_retrieve_chunks: true },
    publication_short_summary: { type: 'string' },
    publication_region: { type: 'string', enable_filtering: true },
    publication_topics: {
      type: 'array',
      items: { type: 'string' },
      enable_filtering: true,
    },
    url: { type: 'string', format: 'uri' },
  },
  additionalProperties: true,
};

describe('isDisplayableProperty', () => {
  it('includes filterable string properties', () => {
    expect(
      isDisplayableProperty({ type: 'string', enable_filtering: true }),
    ).toBe(true);
  });

  it('includes filterable date-formatted string properties', () => {
    expect(
      isDisplayableProperty({
        type: 'string',
        format: 'date',
        enable_filtering: true,
      }),
    ).toBe(true);
  });

  it('includes a first-class date type', () => {
    expect(
      isDisplayableProperty({ type: 'date', enable_filtering: true }),
    ).toBe(true);
  });

  it('excludes properties that do not opt into filtering', () => {
    expect(isDisplayableProperty({ type: 'string' })).toBe(false);
    expect(
      isDisplayableProperty({ type: 'string', enable_filtering: false }),
    ).toBe(false);
  });

  it('excludes filterable non-string/date types (e.g. array)', () => {
    expect(
      isDisplayableProperty({
        type: 'array',
        items: { type: 'string' },
        enable_filtering: true,
      }),
    ).toBe(false);
  });

  it('includes a union type that contains string', () => {
    expect(
      isDisplayableProperty({
        type: ['string', 'null'],
        enable_filtering: true,
      }),
    ).toBe(true);
  });
});

describe('isDateProperty', () => {
  it('detects date-formatted string properties', () => {
    expect(isDateProperty({ type: 'string', format: 'date' })).toBe(true);
    expect(isDateProperty({ type: 'string', format: 'date-time' })).toBe(true);
  });

  it('detects a first-class date type', () => {
    expect(isDateProperty({ type: 'date' })).toBe(true);
  });

  it('does not treat plain or other-format strings as dates', () => {
    expect(isDateProperty({ type: 'string' })).toBe(false);
    expect(isDateProperty({ type: 'string', format: 'uri' })).toBe(false);
  });
});

describe('formatDatePropertyValue', () => {
  it('shows date only for a plain date property', () => {
    expect(
      formatDatePropertyValue({ type: 'string', format: 'date' }, '2024-01-15'),
    ).toBe(new Date('2024-01-15').toLocaleDateString());
  });

  it('shows date and time for a date-time property', () => {
    expect(
      formatDatePropertyValue(
        { type: 'string', format: 'date-time' },
        '2024-01-15T10:30:00Z',
      ),
    ).toBe(new Date('2024-01-15T10:30:00Z').toLocaleString());
  });

  it('returns an empty string for a missing value', () => {
    expect(formatDatePropertyValue({ type: 'date' }, undefined)).toBe('');
  });
});

describe('humanizePropertyKey', () => {
  it('title-cases and de-underscores keys', () => {
    expect(humanizePropertyKey('publication_type')).toBe('Publication Type');
    expect(humanizePropertyKey('publication-region')).toBe(
      'Publication Region',
    );
  });
});

describe('buildMetadataColumns', () => {
  it('appends only filterable string/date properties, in schema order', () => {
    const columns = buildMetadataColumns(SAMPLE_SCHEMA);

    expect(columns.map((column) => column.colId)).toEqual([
      'publication_type',
      'publication_date',
      'publication_region',
    ]);
    expect(columns.map((column) => column.headerName)).toEqual([
      'Publication Type',
      'Publication Date',
      'Publication Region',
    ]);
  });

  it('reads each value from the document metadata map', () => {
    const [typeColumn] = buildMetadataColumns(SAMPLE_SCHEMA);
    const valueGetter = typeColumn.valueGetter;

    // Column definitions built here always use a function value getter.
    expect(typeof valueGetter).toBe('function');
    const getValue = valueGetter as (
      params: ValueGetterParams<Document>,
    ) => unknown;

    const document = {
      metadata: { publication_type: 'sigma' },
    } as unknown as Document;

    expect(getValue({ data: document } as ValueGetterParams<Document>)).toBe(
      'sigma',
    );
    expect(getValue({ data: undefined } as ValueGetterParams<Document>)).toBe(
      undefined,
    );
  });

  it('formats date values in the valueGetter and leaves plain strings raw', () => {
    const columns = buildMetadataColumns(SAMPLE_SCHEMA);
    const byId = Object.fromEntries(
      columns.map((column) => [column.colId, column]),
    );

    const readValue = (colId: string, metadata: Record<string, unknown>) =>
      (
        byId[colId].valueGetter as (
          params: ValueGetterParams<Document>,
        ) => unknown
      )({
        data: { metadata } as unknown as Document,
      } as ValueGetterParams<Document>);

    // publication_date (format: date) renders as a locale date, with no time component, straight
    // from the valueGetter — DialGrid renders String(value) and ignores valueFormatter.
    expect(
      readValue('publication_date', { publication_date: '2024-01-15' }),
    ).toBe(new Date('2024-01-15').toLocaleDateString());
    expect(byId['publication_date'].valueFormatter).toBeUndefined();

    // publication_type (plain string) is returned as-is.
    expect(readValue('publication_type', { publication_type: 'sigma' })).toBe(
      'sigma',
    );
  });

  it('returns no columns when the schema or its properties are absent', () => {
    expect(buildMetadataColumns(undefined)).toEqual([]);
    expect(buildMetadataColumns({})).toEqual([]);
    expect(buildMetadataColumns({ properties: {} })).toEqual([]);
  });
});
