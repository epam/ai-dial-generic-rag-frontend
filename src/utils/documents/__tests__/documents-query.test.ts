import { describe, expect, it } from 'vitest';

import { buildDocumentsQuery } from '@/utils/documents/documents-query';

describe('buildDocumentsQuery', () => {
  it('returns no params for empty/absent sort and filter models', () => {
    expect(buildDocumentsQuery([], {}).toString()).toBe('');
    expect(buildDocumentsQuery(undefined, undefined).toString()).toBe('');
    expect(buildDocumentsQuery(undefined, null).toString()).toBe('');
  });

  it('maps the first sort column to sort/order', () => {
    const params = buildDocumentsQuery(
      [{ colId: 'display_name', sort: 'asc' }],
      {},
    );

    expect(params.get('sort')).toBe('display_name');
    expect(params.get('order')).toBe('asc');
  });

  it('maps active text filters to <field>=<value>, trimmed', () => {
    const params = buildDocumentsQuery(undefined, {
      display_name: {
        filterType: 'text',
        type: 'contains',
        filter: '  report ',
      },
      status: { filterType: 'text', type: 'contains', filter: 'ready' },
    });

    expect(params.get('display_name')).toBe('report');
    expect(params.get('status')).toBe('ready');
  });

  it('ignores blank or non-string filter values', () => {
    const params = buildDocumentsQuery(undefined, {
      display_name: { filter: '   ' },
      size: { filter: 5 },
      mime_type: {},
    });

    expect(params.toString()).toBe('');
  });
});
