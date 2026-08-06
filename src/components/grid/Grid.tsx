'use client';

import type {
  ColDef,
  GridApi,
  GridOptions,
  GridReadyEvent,
  GridSizeChangedEvent,
  IDatasource,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';

import { dialGridTheme } from '@/components/grid/grid-theme';

const HEADER_HEIGHT = 30;
const ROW_HEIGHT = 40;

interface NoRowsOverlayProps {
  title?: string;
  description?: string;
}

/** Empty-state overlay matching DialGrid's placeholder, themed with DIAL text tokens. */
function NoRowsOverlay({ title, description }: NoRowsOverlayProps) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="text-highlight text-sm font-semibold">
        {title ?? 'No results found'}
      </p>
      {description && <p className="text-secondary text-xs">{description}</p>}
    </div>
  );
}

export interface GridProps<T> {
  columnDefs: ColDef<T>[];
  /** When provided, the grid uses the Infinite Row Model (server-side lazy blocks). */
  datasource?: IDatasource;
  /** Used only in client-side mode (when no `datasource` is given). */
  rowData?: T[];
  defaultColDef?: ColDef<T>;
  loading?: boolean;
  getRowId?: GridOptions<T>['getRowId'];
  onGridReady?: (api: GridApi<T>) => void;
  additionalGridOptions?: GridOptions<T>;
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * Thin ag-grid wrapper themed for DIAL Admin, replacing the ui-kit `DialGrid`. Renders the
 * Infinite Row Model when a `datasource` is supplied (rows lazy-load in blocks as the user
 * scrolls), otherwise a client-side grid from `rowData`. Must live in a sized parent (e.g. a
 * `flex-1 min-h-0` container) so it fills the height and scrolls internally.
 */
export function Grid<T>({
  columnDefs,
  datasource,
  rowData,
  defaultColDef,
  loading,
  getRowId,
  onGridReady,
  additionalGridOptions,
  emptyTitle,
  emptyDescription,
}: GridProps<T>) {
  const handleGridReady = (event: GridReadyEvent<T>) => {
    event.api.sizeColumnsToFit();
    onGridReady?.(event.api);
  };

  const handleGridSizeChanged = (event: GridSizeChangedEvent<T>) => {
    event.api.sizeColumnsToFit();
  };

  return (
    <div className="h-full w-full">
      <AgGridReact<T>
        theme={dialGridTheme}
        rowModelType={datasource ? 'infinite' : 'clientSide'}
        datasource={datasource}
        rowData={datasource ? undefined : rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={getRowId}
        loading={loading}
        headerHeight={HEADER_HEIGHT}
        rowHeight={ROW_HEIGHT}
        autoSizeStrategy={{ type: 'fitGridWidth' }}
        suppressCellFocus
        tooltipShowDelay={500}
        noRowsOverlayComponent={NoRowsOverlay}
        noRowsOverlayComponentParams={{
          title: emptyTitle,
          description: emptyDescription,
        }}
        onGridReady={handleGridReady}
        onGridSizeChanged={handleGridSizeChanged}
        {...additionalGridOptions}
      />
    </div>
  );
}
