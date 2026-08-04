'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ColDef,
  GetRowIdParams,
  GridApi,
  GridOptions,
  IDatasource,
  IGetRowsParams,
} from 'ag-grid-community';
import { ButtonVariant, DialButton } from '@epam/ai-dial-ui-kit';

import { AddDocumentDialog } from '@/components/documents/AddDocumentDialog';
import { DocumentsFloatingFilter } from '@/components/documents/DocumentsFloatingFilter';
import { Grid } from '@/components/grid/Grid';
import { useEmbeddingContext } from '@/context/EmbeddingContext';
import type { Document, PaginatedDocuments } from '@/types/documents';
import type { ChannelMetadata, DocumentMetadataSchema } from '@/types/metadata';
import { channelLogger } from '@/utils/channel/logger';
import { buildDocumentsQuery } from '@/utils/documents/documents-query';
import { buildMetadataColumns } from '@/utils/documents/metadata-columns';

const PAGE_SIZE = 25;

const BASE_COLUMN_DEFS: ColDef<Document>[] = [
  // An explicit minWidth keeps these below the shared default floor for narrow columns.
  { field: 'id', headerName: 'ID', width: 88, minWidth: 72, maxWidth: 120 },
  { field: 'display_name', headerName: 'Name', flex: 1 },
  { field: 'size', headerName: 'Size (bytes)', width: 140 },
  { field: 'mime_type', headerName: 'Type', width: 160 },
  { field: 'status', headerName: 'Status', width: 140 },
];

// Applied to every column: the DIAL Admin-style search input (a `contains` text filter) and a
// hover tooltip surfacing the full value when a cell truncates.
const DEFAULT_COL_DEF: ColDef<Document> = {
  resizable: true,
  sortable: true,
  filter: 'agTextColumnFilter',
  floatingFilter: true,
  floatingFilterComponent: DocumentsFloatingFilter,
  tooltipValueGetter: (params) => String(params.value ?? ''),
};

// Infinite Row Model tuning: one block per page, a bounded cache, and a small debounce so rapid
// scrolling doesn't fire a request per row.
const GRID_OPTIONS: GridOptions<Document> = {
  cacheBlockSize: PAGE_SIZE,
  maxBlocksInCache: 40,
  blockLoadDebounceMillis: 200,
};

function getDocumentRowId(params: GetRowIdParams<Document>): string {
  return String(params.data.id);
}

/** Minimal inline "+" glyph for the Add button; no icon package is bundled in this app. */
function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function DocumentsGrid() {
  const { id: applicationId } = useEmbeddingContext();
  const [metadataSchema, setMetadataSchema] =
    useState<DocumentMetadataSchema | null>(null);
  const [isAddOpen, setAddOpen] = useState(false);
  const gridApiRef = useRef<GridApi<Document> | null>(null);

  // Load the document metadata schema once per application; the extra columns (filterable
  // string/date properties, appended after the fixed ones) are derived from it in the memo below.
  useEffect(() => {
    if (!applicationId) {
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams({ applicationId });

    fetch(`/api/metadata?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            setMetadataSchema(null);
          }
          return;
        }

        const json = (await response.json()) as ChannelMetadata;
        if (!cancelled) {
          setMetadataSchema(json.schema);
        }
      })
      .catch((error: unknown) => {
        channelLogger.warn('failed to load document metadata schema', {
          reason: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) {
          setMetadataSchema(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const columnDefs = useMemo<ColDef<Document>[]>(
    () => [
      ...BASE_COLUMN_DEFS,
      ...buildMetadataColumns(metadataSchema ?? undefined),
    ],
    [metadataSchema],
  );

  // The infinite datasource: ag-grid requests blocks by row range and (re)requests them whenever
  // the sort/filter model changes, so getRows forwards startRow/endRow → offset/limit plus the
  // current sort/filter as query params.
  const datasource = useMemo<IDatasource | undefined>(() => {
    if (!applicationId) {
      return undefined;
    }

    return {
      getRows: (params: IGetRowsParams) => {
        const query = buildDocumentsQuery(params.sortModel, params.filterModel);
        query.set('applicationId', applicationId);
        query.set('offset', String(params.startRow));
        query.set('limit', String(params.endRow - params.startRow));

        fetch(`/api/documents?${query.toString()}`)
          .then(async (response) => {
            if (!response.ok) {
              params.failCallback();
              return;
            }
            const json = (await response.json()) as PaginatedDocuments;
            params.successCallback(json.results, json.total_count);
          })
          .catch((error: unknown) => {
            channelLogger.warn('failed to load documents', {
              reason: error instanceof Error ? error.message : String(error),
            });
            params.failCallback();
          });
      },
    };
  }, [applicationId]);

  const handleGridReady = useCallback((api: GridApi<Document>) => {
    gridApiRef.current = api;
  }, []);

  const handleUploaded = useCallback(() => {
    setAddOpen(false);
    // Re-request the loaded blocks so the new document appears.
    gridApiRef.current?.refreshInfiniteCache();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="bg-layer-2 flex min-h-0 flex-1 flex-col gap-4 rounded px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-highlight text-base font-semibold">Documents</h2>
          <DialButton
            variant={ButtonVariant.Primary}
            iconBefore={<PlusIcon />}
            label="Add"
            onClick={() => setAddOpen(true)}
            disabled={!applicationId}
          />
        </div>
        <div className="min-h-0 flex-1">
          <Grid<Document>
            columnDefs={columnDefs}
            datasource={datasource}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={getDocumentRowId}
            additionalGridOptions={GRID_OPTIONS}
            onGridReady={handleGridReady}
            emptyTitle="No documents"
            emptyDescription="This channel has no documents yet."
          />
        </div>
      </div>
      {isAddOpen && applicationId && (
        <AddDocumentDialog
          applicationId={applicationId}
          schema={metadataSchema}
          onClose={() => setAddOpen(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  );
}
