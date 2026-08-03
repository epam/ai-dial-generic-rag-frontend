'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColDef, GridOptions } from 'ag-grid-community';
import {
  ButtonVariant,
  DialButton,
  DialGrid,
  DialNotification,
  DialPagination,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';

import { AddDocumentDialog } from '@/components/documents/AddDocumentDialog';
import { DeleteDocumentDialog } from '@/components/documents/DeleteDocumentDialog';
import { DocumentActionsCell } from '@/components/documents/DocumentActionsCell';
import { DocumentActionsProvider } from '@/components/documents/DocumentActionsContext';
import { DocumentsFloatingFilter } from '@/components/documents/DocumentsFloatingFilter';
import { useEmbeddingContext } from '@/context/EmbeddingContext';
import type { Document, PaginatedDocuments } from '@/types/documents';
import type { ChannelMetadata, DocumentMetadataSchema } from '@/types/metadata';
import { channelLogger } from '@/utils/channel/logger';
import { downloadDocumentFile } from '@/utils/documents/download';
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

// Pinned rightmost kebab (⋮) menu column. Added after the floating-filter map so it gets no search
// input, and non-interactive as a column (sorting/filtering/resizing off).
const ACTIONS_COLUMN: ColDef<Document> = {
  colId: 'actions',
  headerName: '',
  cellRenderer: DocumentActionsCell,
  pinned: 'right',
  width: 56,
  minWidth: 56,
  maxWidth: 64,
  sortable: false,
  filter: false,
  floatingFilter: false,
  resizable: false,
};

function fetchKey(
  applicationId: string,
  page: number,
  refreshTick: number,
): string {
  return `${applicationId}:${page}:${refreshTick}`;
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
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedDocuments | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [metadataSchema, setMetadataSchema] =
    useState<DocumentMetadataSchema | null>(null);
  const [isAddOpen, setAddOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);
  const [notification, setNotification] = useState<{
    variant: NotificationVariant;
    message: string;
  } | null>(null);

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

  useEffect(() => {
    if (!applicationId) {
      return;
    }

    let cancelled = false;
    const key = fetchKey(applicationId, page, refreshTick);
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
  }, [applicationId, page, refreshTick]);

  // Auto-dismiss the transient row-action notification.
  useEffect(() => {
    if (!notification) {
      return;
    }
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  const onDownload = useCallback(
    (targetDocument: Document) => {
      if (!applicationId) {
        return;
      }
      downloadDocumentFile(
        applicationId,
        targetDocument.id,
        targetDocument.display_name,
      );
    },
    [applicationId],
  );

  const onReindex = useCallback(
    async (targetDocument: Document) => {
      if (!applicationId) {
        return;
      }
      const params = new URLSearchParams({ applicationId });
      try {
        const response = await fetch(
          `/api/documents/${targetDocument.id}/reindex?${params.toString()}`,
          { method: 'PUT' },
        );
        if (!response.ok) {
          channelLogger.warn('failed to reindex document', {
            id: targetDocument.id,
            status: response.status,
          });
          setNotification({
            variant: NotificationVariant.Error,
            message: `Failed to reindex "${targetDocument.display_name}".`,
          });
          return;
        }
        setNotification({
          variant: NotificationVariant.Success,
          message: `Reindex started for "${targetDocument.display_name}".`,
        });
        // The row status flips to indexing/processing; reload the page to reflect it.
        setRefreshTick((tick) => tick + 1);
      } catch (error: unknown) {
        channelLogger.warn('failed to reindex document', {
          id: targetDocument.id,
          reason: error instanceof Error ? error.message : String(error),
        });
        setNotification({
          variant: NotificationVariant.Error,
          message: `Failed to reindex "${targetDocument.display_name}".`,
        });
      }
    },
    [applicationId],
  );

  const onRequestDelete = useCallback((targetDocument: Document) => {
    setPendingDelete(targetDocument);
  }, []);

  const documentActions = useMemo(
    () => ({ onDownload, onReindex, onRequestDelete }),
    [onDownload, onReindex, onRequestDelete],
  );

  const columnDefs = useMemo<ColDef<Document>[]>(
    () => [
      ...[
        ...BASE_COLUMN_DEFS,
        ...buildMetadataColumns(metadataSchema ?? undefined),
      ].map((column) => ({
        ...column,
        // DialGrid owns its defaultColDef, so the DIAL Admin-style search input is set per column.
        floatingFilterComponent: DocumentsFloatingFilter,
      })),
      ACTIONS_COLUMN,
    ],
    [metadataSchema],
  );

  const loading = applicationId
    ? loadedKey !== fetchKey(applicationId, page, refreshTick)
    : false;

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total_count / PAGE_SIZE))
    : 1;

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
          <DocumentActionsProvider value={documentActions}>
            <DialGrid<Document>
              columnDefs={columnDefs}
              rowData={data?.results ?? []}
              loading={loading}
              additionalGridOptions={GRID_OPTIONS}
              wrapCustomCellRenderers={false}
              emptyStateTitle="No documents"
              emptyStateDescription="This channel has no documents yet."
            />
          </DocumentActionsProvider>
        </div>
        <div className="flex justify-center">
          <DialPagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>
      {isAddOpen && applicationId && (
        <AddDocumentDialog
          applicationId={applicationId}
          schema={metadataSchema}
          onClose={() => setAddOpen(false)}
          onUploaded={() => {
            setAddOpen(false);
            setPage(1);
            setRefreshTick((tick) => tick + 1);
          }}
        />
      )}
      {pendingDelete && applicationId && (
        <DeleteDocumentDialog
          applicationId={applicationId}
          document={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onDeleted={() => {
            setPendingDelete(null);
            setRefreshTick((tick) => tick + 1);
          }}
        />
      )}
      {notification && (
        <div className="fixed right-4 bottom-4 z-50 w-80 max-w-[90vw]">
          <DialNotification
            variant={notification.variant}
            message={notification.message}
            closable
            onClose={() => setNotification(null)}
          />
        </div>
      )}
    </div>
  );
}
