import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { GridApi, IDatasource, IGetRowsParams } from 'ag-grid-community';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Document } from '@/types/documents';

vi.mock('@/context/EmbeddingContext', () => ({
  useEmbeddingContext: vi.fn(),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialButton: (props: {
    label?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={props.onClick} disabled={props.disabled}>
      {props.label}
    </button>
  ),
  ButtonVariant: { Primary: 'primary' },
  NotificationVariant: {
    Info: 'info',
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
    Loading: 'loading',
  },
  DialNotification: (props: { variant?: string; message: ReactNode }) => (
    <div data-testid="notification" data-variant={props.variant}>
      {props.message}
    </div>
  ),
}));

// Capture what DocumentsGrid passes to the ag-grid wrapper (datasource, onGridReady, columns).
interface CapturedGridProps {
  columnDefs?: { colId?: string; field?: string; headerName?: string }[];
  datasource?: IDatasource;
  onGridReady?: (api: GridApi) => void;
}
const grid: { props?: CapturedGridProps } = {};
vi.mock('@/components/grid/Grid', () => ({
  Grid: (props: CapturedGridProps) => {
    grid.props = props;
    return (
      <div
        data-testid="grid"
        data-has-datasource={String(!!props.datasource)}
        data-col-ids={(props.columnDefs ?? [])
          .map((col) => col.colId ?? col.field ?? '')
          .join('|')}
        data-col-headers={(props.columnDefs ?? [])
          .filter((col) => col.colId !== 'actions')
          .map((col) => col.headerName ?? col.field ?? col.colId ?? '')
          .join('|')}
      />
    );
  },
}));

// Capture the row-action handlers the grid provides via context. The actions cell that consumes
// them is unit-tested separately in DocumentActionsCell.test.
interface DocumentActions {
  onDownload: (document: Document) => void;
  onExport: (document: Document) => void;
  onReindex: (document: Document) => void;
  onRequestDelete: (document: Document) => void;
}
const actions: { current?: DocumentActions } = {};
vi.mock('@/components/documents/DocumentActionsContext', () => ({
  DocumentActionsProvider: (props: {
    value: DocumentActions;
    children: ReactNode;
  }) => {
    actions.current = props.value;
    return <>{props.children}</>;
  },
  useDocumentActions: vi.fn(),
}));

// Stub the dialogs so the grid test exercises wiring, not the modal internals.
vi.mock('@/components/documents/AddDocumentDialog', () => ({
  AddDocumentDialog: (props: {
    applicationId: string;
    onClose: () => void;
    onUploaded: () => void;
  }) => (
    <div data-testid="add-dialog" data-application-id={props.applicationId}>
      <button onClick={props.onUploaded}>mock-upload</button>
      <button onClick={props.onClose}>mock-close</button>
    </div>
  ),
}));

vi.mock('@/components/documents/DeleteDocumentDialog', () => ({
  DeleteDocumentDialog: (props: {
    document: { id: number };
    onClose: () => void;
    onDeleted: () => void;
  }) => (
    <div data-testid="delete-dialog" data-doc-id={props.document.id}>
      <button onClick={props.onDeleted}>confirm-delete</button>
      <button onClick={props.onClose}>cancel-delete</button>
    </div>
  ),
}));

vi.mock('@/utils/documents/download', () => ({
  downloadDocumentFile: vi.fn(),
  exportDocumentBundle: vi.fn(),
}));

import { useEmbeddingContext } from '@/context/EmbeddingContext';
import { DocumentsGrid } from '@/components/documents/DocumentsGrid';
import {
  downloadDocumentFile,
  exportDocumentBundle,
} from '@/utils/documents/download';

const DOC: Document = {
  id: 7,
  url: 'u',
  display_name: 'report.pdf',
  mime_type: 'application/pdf',
  size: 10,
  status: 'ready',
};

const DOCUMENTS_PAGE = {
  total_count: 2,
  offset: 0,
  limit: 25,
  results: [
    { ...DOC, id: 1, display_name: 'a.pdf' },
    { ...DOC, id: 2, display_name: 'b.pdf' },
  ],
};

const METADATA = {
  schema: {
    type: 'object',
    properties: {
      publication_type: { type: 'string', enable_filtering: true },
      publication_title: { type: 'string' },
    },
  },
};

type MockResponse = {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
};

/**
 * Routes fetch by URL: `/api/metadata` → schema; id-scoped `…/reindex` → the reindex override
 * (default OK); everything else → the documents page.
 */
function stubFetch(
  overrides: {
    documents?: MockResponse | Error;
    metadata?: MockResponse | Error;
    reindex?: MockResponse | Error;
  } = {},
) {
  const documents = overrides.documents ?? {
    ok: true,
    json: async () => DOCUMENTS_PAGE,
  };
  const metadata = overrides.metadata ?? {
    ok: true,
    json: async () => METADATA,
  };
  const reindex = overrides.reindex ?? { ok: true, json: async () => DOC };

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const url = String(input);
      let route: MockResponse | Error;
      if (url.startsWith('/api/metadata')) {
        route = metadata;
      } else if (url.includes('/reindex')) {
        route = reindex;
      } else {
        route = documents;
      }
      return route instanceof Error
        ? Promise.reject(route)
        : Promise.resolve(route);
    }),
  );
}

function makeGetRowsParams(
  overrides: Partial<IGetRowsParams> = {},
): IGetRowsParams {
  return {
    startRow: 0,
    endRow: 25,
    sortModel: [],
    filterModel: {},
    successCallback: vi.fn(),
    failCallback: vi.fn(),
    ...overrides,
  } as unknown as IGetRowsParams;
}

function mockEmbedding(id: string | null) {
  vi.mocked(useEmbeddingContext).mockReturnValue({
    theme: null,
    authProvider: null,
    id,
    setEmbeddingParams: vi.fn(),
  } as unknown as ReturnType<typeof useEmbeddingContext>);
}

describe('DocumentsGrid', () => {
  beforeEach(() => {
    mockEmbedding('my-app');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    grid.props = undefined;
    actions.current = undefined;
  });

  it('renders the Documents title and Add button', () => {
    stubFetch();

    render(<DocumentsGrid />);

    expect(
      screen.getByRole('heading', { name: 'Documents' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('provides a datasource with the actions column and filterable metadata columns', async () => {
    stubFetch();

    render(<DocumentsGrid />);

    expect(screen.getByTestId('grid').dataset.hasDatasource).toBe('true');
    expect(screen.getByTestId('grid').dataset.colIds).toContain('actions');
    await waitFor(() =>
      expect(screen.getByTestId('grid').dataset.colHeaders).toContain(
        'Publication Type',
      ),
    );
    expect(screen.getByTestId('grid').dataset.colHeaders).not.toContain(
      'Publication Title',
    );
  });

  it('provides no datasource and disables Add when applicationId is absent', () => {
    mockEmbedding(null);
    stubFetch();

    render(<DocumentsGrid />);

    expect(screen.getByTestId('grid').dataset.hasDatasource).toBe('false');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('getRows fetches the block and reports total_count as the last row', async () => {
    stubFetch();
    render(<DocumentsGrid />);

    const params = makeGetRowsParams();
    grid.props?.datasource?.getRows(params);

    await waitFor(() => expect(params.successCallback).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      '/api/documents?applicationId=my-app&offset=0&limit=25',
    );
    expect(params.successCallback).toHaveBeenCalledWith(
      DOCUMENTS_PAGE.results,
      2,
    );
  });

  it('getRows forwards sort and filter params', async () => {
    stubFetch();
    render(<DocumentsGrid />);

    const params = makeGetRowsParams({
      sortModel: [{ colId: 'display_name', sort: 'asc' }],
      filterModel: { display_name: { filter: 'report' } },
    });
    grid.props?.datasource?.getRows(params);

    await waitFor(() => expect(params.successCallback).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      '/api/documents?sort=display_name&order=asc&display_name=report&applicationId=my-app&offset=0&limit=25',
    );
  });

  it('getRows calls failCallback on a non-OK response', async () => {
    stubFetch({ documents: { ok: false, status: 502 } });
    render(<DocumentsGrid />);

    const params = makeGetRowsParams();
    grid.props?.datasource?.getRows(params);

    await waitFor(() => expect(params.failCallback).toHaveBeenCalled());
    expect(params.successCallback).not.toHaveBeenCalled();
  });

  it('reindex action PUTs, shows a success notification, and refreshes', async () => {
    stubFetch();
    render(<DocumentsGrid />);

    const api = { refreshInfiniteCache: vi.fn() } as unknown as GridApi;
    grid.props?.onGridReady?.(api);

    actions.current?.onReindex(DOC);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/documents/7/reindex?applicationId=my-app',
        { method: 'PUT' },
      ),
    );
    expect(await screen.findByTestId('notification')).toHaveAttribute(
      'data-variant',
      'success',
    );
    expect(api.refreshInfiniteCache).toHaveBeenCalledTimes(1);
  });

  it('reindex action shows an error notification on failure', async () => {
    stubFetch({ reindex: { ok: false, status: 500 } });
    render(<DocumentsGrid />);

    actions.current?.onReindex(DOC);

    expect(await screen.findByTestId('notification')).toHaveAttribute(
      'data-variant',
      'error',
    );
  });

  it('download action calls the download util', () => {
    stubFetch();
    render(<DocumentsGrid />);

    actions.current?.onDownload(DOC);

    expect(downloadDocumentFile).toHaveBeenCalledWith(
      'my-app',
      7,
      'report.pdf',
    );
  });

  it('export action calls the export util with the fallback filename', () => {
    stubFetch();
    render(<DocumentsGrid />);

    actions.current?.onExport(DOC);

    expect(exportDocumentBundle).toHaveBeenCalledWith(
      'my-app',
      7,
      'report.pdf.msgpack',
    );
  });

  it('delete action opens the confirmation and refreshes after delete', async () => {
    stubFetch();
    render(<DocumentsGrid />);

    const api = { refreshInfiniteCache: vi.fn() } as unknown as GridApi;
    grid.props?.onGridReady?.(api);

    actions.current?.onRequestDelete(DOC);

    const dialog = await screen.findByTestId('delete-dialog');
    expect(dialog.dataset.docId).toBe('7');

    fireEvent.click(screen.getByRole('button', { name: 'confirm-delete' }));

    await waitFor(() =>
      expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument(),
    );
    expect(api.refreshInfiniteCache).toHaveBeenCalledTimes(1);
  });

  it('refreshes the grid after an upload', async () => {
    stubFetch();
    render(<DocumentsGrid />);

    const api = { refreshInfiniteCache: vi.fn() } as unknown as GridApi;
    grid.props?.onGridReady?.(api);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(await screen.findByRole('button', { name: 'mock-upload' }));

    expect(api.refreshInfiniteCache).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('add-dialog')).not.toBeInTheDocument();
  });
});
