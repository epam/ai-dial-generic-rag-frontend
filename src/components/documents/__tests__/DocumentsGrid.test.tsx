import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/context/EmbeddingContext', () => ({
  useEmbeddingContext: vi.fn(),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  // Renders the pinned actions column's cell for each row (real DocumentActionsCell), so the row
  // actions are clickable, and exposes col headers/ids for assertions. Actions column is excluded
  // from col-headers so the existing header assertions stay stable.
  DialGrid: (props: {
    rowData?: { id: number }[];
    loading?: boolean;
    columnDefs?: {
      colId?: string;
      field?: string;
      headerName?: string;
      cellRenderer?: ComponentType<{ data: { id: number } }>;
    }[];
  }) => {
    const ActionsRenderer = props.columnDefs?.find(
      (col) => col.colId === 'actions',
    )?.cellRenderer;
    return (
      <div
        data-testid="grid"
        data-loading={String(!!props.loading)}
        data-row-count={String(props.rowData?.length ?? 0)}
        data-col-headers={(props.columnDefs ?? [])
          .filter((col) => col.colId !== 'actions')
          .map((col) => col.headerName ?? col.field ?? col.colId ?? '')
          .join('|')}
        data-col-ids={(props.columnDefs ?? [])
          .map((col) => col.colId ?? col.field ?? '')
          .join('|')}
      >
        {ActionsRenderer &&
          (props.rowData ?? []).map((row) => (
            <div key={row.id} data-testid="row-actions">
              <ActionsRenderer data={row} />
            </div>
          ))}
      </div>
    );
  },
  DialPagination: (props: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  }) => (
    <div
      data-testid="pagination"
      data-page={props.page}
      data-total-pages={props.totalPages}
    >
      <button onClick={() => props.onPageChange(props.page + 1)}>next</button>
    </div>
  ),
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
  // Used by the real DocumentActionsCell: render each menu item as a button.
  DropdownTrigger: { Click: 'click' },
  DialGhostIconButton: () => (
    <button aria-label="Document actions">menu</button>
  ),
  DialDropdown: (props: {
    items?: { key: string; label: ReactNode; onClick?: () => void }[];
    children: ReactNode;
  }) => (
    <div>
      {props.children}
      {props.items?.map((item) => (
        <button key={item.key} onClick={() => item.onClick?.()}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

// Stub the dialogs so the grid test exercises open/close/refresh wiring, not the modal internals.
vi.mock('@/components/documents/AddDocumentDialog', () => ({
  AddDocumentDialog: (props: {
    applicationId: string;
    onClose: () => void;
    onUploaded: (document: unknown) => void;
  }) => (
    <div data-testid="add-dialog" data-application-id={props.applicationId}>
      <button onClick={() => props.onUploaded({ id: 99 })}>mock-upload</button>
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
}));

import { useEmbeddingContext } from '@/context/EmbeddingContext';
import { DocumentsGrid } from '@/components/documents/DocumentsGrid';
import { downloadDocumentFile } from '@/utils/documents/download';

const BASE_HEADERS = ['ID', 'Name', 'Size (bytes)', 'Type', 'Status'];

const DOCUMENTS_PAGE = {
  total_count: 2,
  offset: 0,
  limit: 25,
  results: [
    {
      id: 1,
      url: 'u1',
      display_name: 'a.pdf',
      mime_type: 'application/pdf',
      size: 10,
      status: 'ready',
    },
    {
      id: 2,
      url: 'u2',
      display_name: 'b.pdf',
      mime_type: 'application/pdf',
      size: 20,
      status: 'error',
    },
  ],
};

const METADATA = {
  schema: {
    type: 'object',
    properties: {
      publication_type: { type: 'string', enable_filtering: true },
      publication_date: {
        type: 'string',
        format: 'date',
        enable_filtering: true,
      },
      publication_title: { type: 'string' },
      publication_region: { type: 'string', enable_filtering: true },
      publication_topics: {
        type: 'array',
        items: { type: 'string' },
        enable_filtering: true,
      },
    },
  },
};

type MockResponse = {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
};

/**
 * Routes fetch by URL: `/api/metadata` → the schema, everything else → the documents page.
 * Either route can be overridden per test, including with an `Error` to simulate a rejection.
 */
function stubFetch(
  overrides: {
    documents?: MockResponse | Error;
    metadata?: MockResponse | Error;
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

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const route = String(input).startsWith('/api/metadata')
        ? metadata
        : documents;
      return route instanceof Error
        ? Promise.reject(route)
        : Promise.resolve(route);
    }),
  );
}

function headers(): string[] {
  const value = screen.getByTestId('grid').dataset.colHeaders ?? '';
  return value.length ? value.split('|') : [];
}

const SINGLE_DOC_PAGE = {
  total_count: 1,
  offset: 0,
  limit: 25,
  results: [
    {
      id: 7,
      url: 'u',
      display_name: 'report.pdf',
      mime_type: 'application/pdf',
      size: 10,
      status: 'ready',
    },
  ],
};

/** Stubs a single-document page (so each row-action label is unique), renders, and waits for it. */
async function renderWithSingleDocument() {
  stubFetch({ documents: { ok: true, json: async () => SINGLE_DOC_PAGE } });
  render(<DocumentsGrid />);
  await waitFor(() =>
    expect(screen.getByTestId('grid').dataset.rowCount).toBe('1'),
  );
}

/** Counts calls to the documents LIST endpoint (excludes id-scoped `/api/documents/{id}/...`). */
function listCallCount(): number {
  return (fetch as ReturnType<typeof vi.fn>).mock.calls.filter((call) =>
    String(call[0]).startsWith('/api/documents?'),
  ).length;
}

describe('DocumentsGrid', () => {
  beforeEach(() => {
    vi.mocked(useEmbeddingContext).mockReturnValue({
      theme: null,
      authProvider: null,
      id: 'my-app',
      setEmbeddingParams: vi.fn(),
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches page 1 on mount and renders the rows', async () => {
    stubFetch();

    render(<DocumentsGrid />);

    expect(fetch).toHaveBeenCalledWith(
      '/api/documents?applicationId=my-app&offset=0&limit=25',
    );

    await waitFor(() => {
      expect(screen.getByTestId('grid').dataset.rowCount).toBe('2');
    });
    expect(screen.getByTestId('grid').dataset.loading).toBe('false');
    expect(screen.getByTestId('pagination').dataset.totalPages).toBe('1');
  });

  it('appends filterable string/date metadata properties after the fixed columns', async () => {
    stubFetch();

    render(<DocumentsGrid />);

    await waitFor(() => {
      expect(headers()).toContain('Publication Type');
    });

    // Fixed columns are preserved and stay first.
    expect(headers().slice(0, BASE_HEADERS.length)).toEqual(BASE_HEADERS);
    // Filterable string/date properties are appended.
    expect(headers()).toContain('Publication Date');
    expect(headers()).toContain('Publication Region');
    // Non-filterable and array-typed properties are excluded.
    expect(headers()).not.toContain('Publication Title');
    expect(headers()).not.toContain('Publication Topics');
  });

  it('keeps only the fixed columns when the metadata request fails', async () => {
    stubFetch({ metadata: { ok: false, status: 502 } });

    render(<DocumentsGrid />);

    await waitFor(() => {
      expect(screen.getByTestId('grid').dataset.rowCount).toBe('2');
    });
    expect(headers()).toEqual(BASE_HEADERS);
  });

  it('does not fetch when applicationId is absent', () => {
    vi.mocked(useEmbeddingContext).mockReturnValue({
      theme: null,
      authProvider: null,
      id: null,
      setEmbeddingParams: vi.fn(),
    });
    stubFetch();

    render(<DocumentsGrid />);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('re-fetches with the new offset when the page changes', async () => {
    stubFetch({
      documents: {
        ok: true,
        json: async () => ({
          total_count: 60,
          offset: 0,
          limit: 25,
          results: [],
        }),
      },
    });

    render(<DocumentsGrid />);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/documents?applicationId=my-app&offset=0&limit=25',
      ),
    );

    screen.getByText('next').click();

    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        '/api/documents?applicationId=my-app&offset=25&limit=25',
      ),
    );
  });

  it('clears rows when the proxy responds non-OK', async () => {
    stubFetch({ documents: { ok: false, status: 502 } });

    render(<DocumentsGrid />);

    await waitFor(() => {
      expect(screen.getByTestId('grid').dataset.loading).toBe('false');
    });
    expect(screen.getByTestId('grid').dataset.rowCount).toBe('0');
  });

  it('clears rows when the fetch itself rejects unexpectedly', async () => {
    stubFetch({
      documents: new Error('offline'),
      metadata: new Error('offline'),
    });

    render(<DocumentsGrid />);

    await waitFor(() => {
      expect(screen.getByTestId('grid').dataset.loading).toBe('false');
    });
    expect(screen.getByTestId('grid').dataset.rowCount).toBe('0');
  });

  it('renders the Documents title and an Add button', () => {
    stubFetch();

    render(<DocumentsGrid />);

    expect(
      screen.getByRole('heading', { name: 'Documents' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('opens the add-document dialog when Add is clicked', async () => {
    stubFetch();

    render(<DocumentsGrid />);

    expect(screen.queryByTestId('add-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    const dialog = await screen.findByTestId('add-dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.dataset.applicationId).toBe('my-app');
  });

  it('disables the Add button when applicationId is absent', () => {
    vi.mocked(useEmbeddingContext).mockReturnValue({
      theme: null,
      authProvider: null,
      id: null,
      setEmbeddingParams: vi.fn(),
    });
    stubFetch();

    render(<DocumentsGrid />);

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('closes the dialog and re-fetches the documents after an upload', async () => {
    stubFetch();

    render(<DocumentsGrid />);

    await waitFor(() => {
      expect(screen.getByTestId('grid').dataset.rowCount).toBe('2');
    });

    const documentCalls = () =>
      (fetch as ReturnType<typeof vi.fn>).mock.calls.filter((call) =>
        String(call[0]).startsWith('/api/documents'),
      ).length;
    const before = documentCalls();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(await screen.findByRole('button', { name: 'mock-upload' }));

    await waitFor(() => expect(documentCalls()).toBe(before + 1));
    expect(screen.queryByTestId('add-dialog')).not.toBeInTheDocument();
  });

  it('renders a pinned actions column', async () => {
    stubFetch();

    render(<DocumentsGrid />);

    await waitFor(() =>
      expect(screen.getByTestId('grid').dataset.rowCount).toBe('2'),
    );
    expect(screen.getByTestId('grid').dataset.colIds).toContain('actions');
  });

  it('reindexes a document and re-fetches the list', async () => {
    await renderWithSingleDocument();
    const before = listCallCount();

    fireEvent.click(screen.getByRole('button', { name: 'Reindex' }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/documents/7/reindex?applicationId=my-app',
        { method: 'PUT' },
      ),
    );
    await waitFor(() => expect(listCallCount()).toBe(before + 1));
    expect(await screen.findByTestId('notification')).toHaveAttribute(
      'data-variant',
      'success',
    );
  });

  it('shows an error notification when reindex fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (String(input).startsWith('/api/metadata')) {
          return Promise.resolve({ ok: true, json: async () => METADATA });
        }
        if (String(input).includes('/reindex')) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.resolve({ ok: true, json: async () => SINGLE_DOC_PAGE });
      }),
    );

    render(<DocumentsGrid />);
    await waitFor(() =>
      expect(screen.getByTestId('grid').dataset.rowCount).toBe('1'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reindex' }));

    expect(await screen.findByTestId('notification')).toHaveAttribute(
      'data-variant',
      'error',
    );
  });

  it('downloads a document via the download util', async () => {
    await renderWithSingleDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(downloadDocumentFile).toHaveBeenCalledWith(
      'my-app',
      7,
      'report.pdf',
    );
  });

  it('opens the delete confirmation and re-fetches after a delete', async () => {
    await renderWithSingleDocument();
    const before = listCallCount();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByTestId('delete-dialog');
    expect(dialog.dataset.docId).toBe('7');

    fireEvent.click(screen.getByRole('button', { name: 'confirm-delete' }));

    await waitFor(() =>
      expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(listCallCount()).toBe(before + 1));
  });
});
