import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Capture the props AgGridReact receives, without touching real ag-grid.
let lastProps: Record<string, unknown> | undefined;
vi.mock('ag-grid-react', () => ({
  AgGridReact: (props: Record<string, unknown>) => {
    lastProps = props;
    return (
      <div
        data-testid="ag-grid"
        data-row-model={String(props.rowModelType)}
      />
    );
  },
}));

// The real grid-theme registers ag-grid modules on import; stub it so the test stays isolated.
vi.mock('@/components/grid/grid-theme', () => ({
  dialGridTheme: { mockTheme: true },
}));

import { Grid } from '@/components/grid/Grid';

describe('Grid', () => {
  afterEach(() => {
    cleanup();
    lastProps = undefined;
  });

  it('uses the infinite row model when a datasource is provided', () => {
    const datasource = { getRows: vi.fn() };

    render(<Grid columnDefs={[]} datasource={datasource} />);

    expect(screen.getByTestId('ag-grid').dataset.rowModel).toBe('infinite');
    expect(lastProps?.datasource).toBe(datasource);
    expect(lastProps?.rowData).toBeUndefined();
    expect(lastProps?.theme).toEqual({ mockTheme: true });
  });

  it('uses the client-side row model with rowData when no datasource', () => {
    const rows = [{ id: 1 }];

    render(<Grid columnDefs={[]} rowData={rows} />);

    expect(screen.getByTestId('ag-grid').dataset.rowModel).toBe('clientSide');
    expect(lastProps?.rowData).toBe(rows);
    expect(lastProps?.datasource).toBeUndefined();
  });

  it('passes the empty-state overlay params', () => {
    render(
      <Grid
        columnDefs={[]}
        emptyTitle="No documents"
        emptyDescription="Nothing here."
      />,
    );

    expect(lastProps?.noRowsOverlayComponentParams).toEqual({
      title: 'No documents',
      description: 'Nothing here.',
    });
  });
});
