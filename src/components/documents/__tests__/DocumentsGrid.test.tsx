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
}));

// Capture what DocumentsGrid passes to the grid wrapper so tests can drive the datasource + api.
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
        data-col-headers={(props.columnDefs ?? [])
          .map((col) => col.headerName ?? col.field ?? col.colId ?? '')
          .join('|')}
      />
    );
  },
}));

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

import { useEmbeddingContext } from '@/context/EmbeddingContext';
import { DocumentsGrid } from '@/components/documents/DocumentsGrid';

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
      publication_title: { type: 'string' },
    },
  },
};

type MockResponse = {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
};

/** Routes fetch by URL: `/api/metadata` → schema, everything else → the documents page. */
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
  });

  it('renders the Documents title and Add button', () => {
    stubFetch();

    render(<DocumentsGrid />);

    expect(
      screen.getByRole('heading', { name: 'Documents' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('provides a datasource and appends filterable metadata columns', async () => {
    stubFetch();

    render(<DocumentsGrid />);

    expect(screen.getByTestId('grid').dataset.hasDatasource).toBe('true');
    await waitFor(() =>
      expect(screen.getByTestId('grid').dataset.colHeaders).toContain(
        'Publication Type',
      ),
    );
    // A non-filterable metadata property is not added as a column.
    expect(screen.getByTestId('grid').dataset.colHeaders).not.toContain(
      'Publication Title',
    );
  });

  it('does not provide a datasource when applicationId is absent', () => {
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

  it('refreshes the grid after an upload', async () => {
    stubFetch();
    render(<DocumentsGrid />);

    const api = {
      refreshInfiniteCache: vi.fn(),
    } as unknown as GridApi;
    grid.props?.onGridReady?.(api);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(await screen.findByRole('button', { name: 'mock-upload' }));

    expect(api.refreshInfiniteCache).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('add-dialog')).not.toBeInTheDocument();
  });
});
