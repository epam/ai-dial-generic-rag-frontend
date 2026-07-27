import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/context/EmbeddingContext', () => ({
  useEmbeddingContext: vi.fn(),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialGrid: (props: { rowData?: unknown[]; loading?: boolean }) => (
    <div
      data-testid="grid"
      data-loading={String(!!props.loading)}
      data-row-count={String(props.rowData?.length ?? 0)}
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
}));

import { useEmbeddingContext } from '@/context/EmbeddingContext';
import { DocumentsGrid } from '@/components/documents/DocumentsGrid';

describe('DocumentsGrid', () => {
  beforeEach(() => {
    vi.mocked(useEmbeddingContext).mockReturnValue({
      theme: null,
      authProvider: null,
      id: 'my-app',
      setEmbeddingParams: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches page 1 on mount and renders the rows', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
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
      }),
    });

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

  it('does not fetch when applicationId is absent', () => {
    vi.mocked(useEmbeddingContext).mockReturnValue({
      theme: null,
      authProvider: null,
      id: null,
      setEmbeddingParams: vi.fn(),
    });

    render(<DocumentsGrid />);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('re-fetches with the new offset when the page changes', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        total_count: 60,
        offset: 0,
        limit: 25,
        results: [],
      }),
    });

    render(<DocumentsGrid />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    screen.getByText('next').click();

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/documents?applicationId=my-app&offset=25&limit=25',
    );
  });

  it('clears rows when the proxy responds non-OK', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 502,
    });

    render(<DocumentsGrid />);

    await waitFor(() => {
      expect(screen.getByTestId('grid').dataset.loading).toBe('false');
    });
    expect(screen.getByTestId('grid').dataset.rowCount).toBe('0');
  });

  it('clears rows when the fetch itself rejects unexpectedly', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));

    render(<DocumentsGrid />);

    await waitFor(() => {
      expect(screen.getByTestId('grid').dataset.loading).toBe('false');
    });
    expect(screen.getByTestId('grid').dataset.rowCount).toBe('0');
  });
});
