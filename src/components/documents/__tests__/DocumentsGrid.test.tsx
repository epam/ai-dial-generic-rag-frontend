import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/context/EmbeddingContext', () => ({
  useEmbeddingContext: vi.fn(),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialGrid: (props: {
    rowData?: unknown[];
    loading?: boolean;
    columnDefs?: { colId?: string; field?: string; headerName?: string }[];
  }) => (
    <div
      data-testid="grid"
      data-loading={String(!!props.loading)}
      data-row-count={String(props.rowData?.length ?? 0)}
      data-col-headers={(props.columnDefs ?? [])
        .map((col) => col.headerName ?? col.field ?? col.colId ?? '')
        .join('|')}
    />
  ),
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
}));

// Stub the dialog so the grid test exercises open/close/refresh wiring, not the modal internals.
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

import { useEmbeddingContext } from '@/context/EmbeddingContext';
import { DocumentsGrid } from '@/components/documents/DocumentsGrid';

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
});
