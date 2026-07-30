import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from '@testing-library/react';
import type { IFloatingFilterParams } from 'ag-grid-community';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentsFloatingFilter } from '@/components/documents/DocumentsFloatingFilter';

function makeParams(currentFilter: string | null = null) {
  const onFloatingFilterChanged = vi.fn();
  const parentFilterInstance = vi.fn(
    (
      cb: (instance: {
        onFloatingFilterChanged: typeof onFloatingFilterChanged;
      }) => void,
    ) => cb({ onFloatingFilterChanged }),
  );
  const params = {
    currentParentModel: () =>
      currentFilter === null ? null : { filter: currentFilter },
    parentFilterInstance,
  } as unknown as IFloatingFilterParams;

  return { params, onFloatingFilterChanged, parentFilterInstance };
}

describe('DocumentsFloatingFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders a search input seeded from the current filter model', () => {
    const { params } = makeParams('sigma');
    render(<DocumentsFloatingFilter {...params} />);

    expect(screen.getByPlaceholderText<HTMLInputElement>('Search').value).toBe(
      'sigma',
    );
  });

  it('debounces typing into a single contains filter change', () => {
    const { params, onFloatingFilterChanged } = makeParams();
    render(<DocumentsFloatingFilter {...params} />);

    const input = screen.getByPlaceholderText('Search');
    fireEvent.change(input, { target: { value: 's' } });
    fireEvent.change(input, { target: { value: 'sig' } });

    // Nothing fires until the debounce elapses.
    expect(onFloatingFilterChanged).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onFloatingFilterChanged).toHaveBeenCalledTimes(1);
    expect(onFloatingFilterChanged).toHaveBeenCalledWith('contains', 'sig');
  });
});
