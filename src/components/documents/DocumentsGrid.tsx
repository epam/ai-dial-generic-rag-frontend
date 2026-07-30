'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ColDef, GridOptions } from 'ag-grid-community';
import { DialGrid, DialPagination } from '@epam/ai-dial-ui-kit';

import { DocumentsFloatingFilter } from '@/components/documents/DocumentsFloatingFilter';
import { useEmbeddingContext } from '@/context/EmbeddingContext';
import type { Document, PaginatedDocuments } from '@/types/documents';
import type { ChannelMetadata } from '@/types/metadata';
import { channelLogger } from '@/utils/channel/logger';
import { buildMetadataColumns } from '@/utils/documents/metadata-columns';

const PAGE_SIZE = 25;

const BASE_COLUMN_DEFS: ColDef<Document>[] = [
  // An explicit minWidth is required to override DialGrid's inherited 150px defaultColDef floor.
  { field: 'id', headerName: 'ID', width: 88, minWidth: 72, maxWidth: 120 },
  { field: 'display_name', headerName: 'Name', flex: 1 },
  { field: 'size', headerName: 'Size (bytes)', width: 140 },
  { field: 'mime_type', headerName: 'Type', width: 160 },
  { field: 'status', headerName: 'Status', width: 140 },
];

// Match DIAL Admin's compact header (30px vs DialGrid's default 40px). additionalGridOptions is
// merged last, so this overrides the height without replacing DialGrid's defaultColDef.
const GRID_OPTIONS: GridOptions<Document> = { headerHeight: 30 };

function fetchKey(applicationId: string, page: number): string {
  return `${applicationId}:${page}`;
}

export function DocumentsGrid() {
  const { id: applicationId } = useEmbeddingContext();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedDocuments | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [metadataColumns, setMetadataColumns] = useState<ColDef<Document>[]>(
    [],
  );

  // Load the document metadata schema once per application and derive the extra columns
  // (filterable string/date properties) appended after the fixed columns above.
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
            setMetadataColumns([]);
          }
          return;
        }

        const json = (await response.json()) as ChannelMetadata;
        if (!cancelled) {
          setMetadataColumns(buildMetadataColumns(json.schema));
        }
      })
      .catch((error: unknown) => {
        channelLogger.warn('failed to load document metadata schema', {
          reason: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) {
          setMetadataColumns([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  useEffect(() => {
    if (!applicationId) {
      return;
    }

    let cancelled = false;
    const key = fetchKey(applicationId, page);
    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams({
      applicationId,
      offset: String(offset),
      limit: String(PAGE_SIZE),
    });

    fetch(`/api/documents?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            setData(null);
          }
          return;
        }

        const json = (await response.json()) as PaginatedDocuments;
        if (!cancelled) {
          setData(json);
        }
      })
      .catch((error: unknown) => {
        channelLogger.warn('failed to load documents unexpectedly', {
          reason: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) {
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedKey(key);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, page]);

  const columnDefs = useMemo<ColDef<Document>[]>(
    () =>
      [...BASE_COLUMN_DEFS, ...metadataColumns].map((column) => ({
        ...column,
        // DialGrid owns its defaultColDef, so the DIAL Admin-style search input is set per column.
        floatingFilterComponent: DocumentsFloatingFilter,
      })),
    [metadataColumns],
  );

  const loading = applicationId
    ? loadedKey !== fetchKey(applicationId, page)
    : false;

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total_count / PAGE_SIZE))
    : 1;

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="bg-layer-2 flex min-h-0 flex-1 flex-col gap-4 rounded px-6 py-4">
        <div className="min-h-0 flex-1">
          <DialGrid<Document>
            columnDefs={columnDefs}
            rowData={data?.results ?? []}
            loading={loading}
            additionalGridOptions={GRID_OPTIONS}
            emptyStateTitle="No documents"
            emptyStateDescription="This channel has no documents yet."
          />
        </div>
        <div className="flex justify-center">
          <DialPagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
