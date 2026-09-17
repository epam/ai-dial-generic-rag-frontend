import { describe, expect, it } from 'vitest';

import { buildDocumentsQuery } from '@/utils/documents/documents-query';

describe('buildDocumentsQuery', () => {
  it('returns no params for empty/absent sort and filter models', () => {
    expect(buildDocumentsQuery([], {}).toString()).toBe('');
    expect(buildDocumentsQuery(undefined, undefined).toString()).toBe('');
    expect(buildDocumentsQuery(undefined, null).toString()).toBe('');
  });

  it('maps a single sort column to one sort=<field>,<dir> entry', () => {
    const params = buildDocumentsQuery(
      [{ colId: 'display_name', sort: 'asc' }],
      {},
    );

    expect(params.getAll('sort')).toEqual(['display_name,asc']);
  });

  it('maps multiple sort columns to repeated sort keys, in order', () => {
    const params = buildDocumentsQuery(
      [
        { colId: 'display_name', sort: 'asc' },
        { colId: 'status', sort: 'desc' },
      ],
      {},
    );

    expect(params.getAll('sort')).toEqual(['display_name,asc', 'status,desc']);
  });

  it('maps active text filters to <field>[eq]=<value>, trimmed', () => {
    const params = buildDocumentsQuery(undefined, {
      publication_type: {
        filterType: 'text',
        type: 'equals',
        filter: '  report ',
      },
      publication_region: {
        filterType: 'text',
        type: 'equals',
        filter: 'emea',
      },
    });

    expect(params.get('publication_type[eq]')).toBe('report');
    expect(params.get('publication_region[eq]')).toBe('emea');
  });

  it('maps a date range filter to <field>[start]/<field>[end], date-only', () => {
    const params = buildDocumentsQuery(undefined, {
      publication_date: {
        filterType: 'date',
        type: 'inRange',
        dateFrom: '2024-01-01 00:00:00',
        dateTo: '2024-01-31 00:00:00',
      },
    });

    expect(params.get('publication_date[start]')).toBe('2024-01-01');
    expect(params.get('publication_date[end]')).toBe('2024-01-31');
  });

  it('maps a one-sided date range filter to only the bound that is present', () => {
    const params = buildDocumentsQuery(undefined, {
      publication_date: {
        filterType: 'date',
        type: 'inRange',
        dateFrom: '2024-01-01 00:00:00',
        dateTo: null,
      },
    });

    expect(params.get('publication_date[start]')).toBe('2024-01-01');
    expect(params.has('publication_date[end]')).toBe(false);
  });

  it('ignores blank or non-string filter values', () => {
    const params = buildDocumentsQuery(undefined, {
      publication_type: { filterType: 'text', filter: '   ' },
      size: { filterType: 'text', filter: 5 },
      mime_type: {},
    });

    expect(params.toString()).toBe('');
  });

  it('ignores a date filter with a non-string dateFrom/dateTo', () => {
    const params = buildDocumentsQuery(undefined, {
      publication_date: {
        filterType: 'date',
        type: 'inRange',
        dateFrom: 12345,
        dateTo: undefined,
      },
    });

    expect(params.toString()).toBe('');
  });

  it('combines multi-column sort with a text filter and a date range filter', () => {
    const params = buildDocumentsQuery(
      [
        { colId: 'display_name', sort: 'asc' },
        { colId: 'status', sort: 'desc' },
      ],
      {
        publication_type: {
          filterType: 'text',
          type: 'equals',
          filter: 'report',
        },
        publication_date: {
          filterType: 'date',
          type: 'inRange',
          dateFrom: '2024-01-01 00:00:00',
          dateTo: '2024-01-31 00:00:00',
        },
      },
    );

    expect(params.getAll('sort')).toEqual(['display_name,asc', 'status,desc']);
    expect(params.get('publication_type[eq]')).toBe('report');
    expect(params.get('publication_date[start]')).toBe('2024-01-01');
    expect(params.get('publication_date[end]')).toBe('2024-01-31');
  });
});
