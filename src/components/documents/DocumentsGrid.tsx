'use client';

import { useEffect, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { DialGrid, DialPagination } from '@epam/ai-dial-ui-kit';

import { useEmbeddingContext } from '@/context/EmbeddingContext';
import type { Document, PaginatedDocuments } from '@/types/documents';
import { channelLogger } from '@/utils/channel/logger';

const PAGE_SIZE = 25;

const columnDefs: ColDef<Document>[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  { field: 'display_name', headerName: 'Name', flex: 1 },
  { field: 'size', headerName: 'Size (bytes)', width: 140 },
  { field: 'mime_type', headerName: 'Type', width: 160 },
  { field: 'status', headerName: 'Status', width: 140 },
  { field: 'url', headerName: 'URL', flex: 1 },
];

function fetchKey(applicationId: string, page: number): string {
  return `${applicationId}:${page}`;
}

export function DocumentsGrid() {
  const { id: applicationId } = useEmbeddingContext();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedDocuments | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

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

  const loading = applicationId
    ? loadedKey !== fetchKey(applicationId, page)
    : false;

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total_count / PAGE_SIZE))
    : 1;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 p-4">
      <div className="min-h-0 flex-1">
        <DialGrid<Document>
          columnDefs={columnDefs}
          rowData={data?.results ?? []}
          loading={loading}
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
  );
}
