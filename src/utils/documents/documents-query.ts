import type { SortModelItem } from 'ag-grid-community';

interface FilterModelEntry {
  filterType?: string;
  /** Text filter model (`filterType: 'text'`): the raw input value. */
  filter?: unknown;
  /** Date filter model (`filterType: 'date'`, `type: 'inRange'`): range bounds, `'YYYY-MM-DD HH:mm:ss'`. */
  dateFrom?: unknown;
  dateTo?: unknown;
}

/** Ag-grid date filter values carry a time component; the channel's `start`/`end` filters take a plain date. */
function dateOnly(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim()
    ? value.trim().split(' ')[0]
    : undefined;
}

/**
 * Translates ag-grid's sort + filter model into channel list query params, matching the channel's
 * `GET /channel/documents` contract:
 * - Sort: one `sort=<field>,<asc|desc>` entry per active sort column, as repeated query keys
 *   (confirmed against a live call — the channel does not accept a comma-joined list).
 * - Filters (metadata columns only — the channel only supports filtering by metadata fields):
 *   `<field>[eq]=<value>` for a text filter, `<field>[start]=<date>`/`<field>[end]=<date>` for a
 *   date range filter. There is no `contains`/substring operator on the channel.
 */
export function buildDocumentsQuery(
  sortModel: SortModelItem[] | undefined,
  filterModel: Record<string, unknown> | null | undefined,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const sort of sortModel ?? []) {
    params.append('sort', `${sort.colId},${sort.sort}`);
  }

  for (const [field, rawModel] of Object.entries(filterModel ?? {})) {
    const model = rawModel as FilterModelEntry | null;
    if (!model) {
      continue;
    }

    if (model.filterType === 'date') {
      const start = dateOnly(model.dateFrom);
      const end = dateOnly(model.dateTo);
      if (start) {
        params.set(`${field}[start]`, start);
      }
      if (end) {
        params.set(`${field}[end]`, end);
      }
      continue;
    }

    if (typeof model.filter === 'string' && model.filter.trim()) {
      params.set(`${field}[eq]`, model.filter.trim());
    }
  }

  return params;
}
