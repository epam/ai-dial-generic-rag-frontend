import type { SortModelItem } from 'ag-grid-community';

/**
 * Translates ag-grid's sort + filter model into channel list query params.
 *
 * This is the single FE↔BE contract for server-side sort/filter — align the shapes here with the
 * backend filter support being added:
 * - Sorting (single active column): `sort=<field>&order=<asc|desc>`.
 * - Text filters: one `<field>=<value>` per active column, with `contains` semantics
 *   (`DocumentsFloatingFilter` emits `contains`). The column `field`/`colId` doubles as the query
 *   key; none collide with the reserved `applicationId`/`offset`/`limit`/`sort`/`order`.
 */
export function buildDocumentsQuery(
  sortModel: SortModelItem[] | undefined,
  filterModel: Record<string, unknown> | null | undefined,
): URLSearchParams {
  const params = new URLSearchParams();

  const sort = sortModel?.[0];
  if (sort) {
    params.set('sort', sort.colId);
    params.set('order', sort.sort);
  }

  for (const [field, model] of Object.entries(filterModel ?? {})) {
    const value = (model as { filter?: unknown } | null)?.filter;
    if (typeof value === 'string' && value.trim()) {
      params.set(field, value.trim());
    }
  }

  return params;
}
