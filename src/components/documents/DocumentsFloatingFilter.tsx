'use client';

import type {
  IFloatingFilterParams,
  IFloatingFilterParent,
} from 'ag-grid-community';
import { IconSearch } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 400;

/**
 * Custom ag-Grid floating filter for the documents grid, ported from DIAL Admin's `FloatingFilter`
 * so the column search inputs look identical: a bordered box with a search icon wrapping a
 * borderless input, debounced into a `contains` text filter.
 */
export function DocumentsFloatingFilter(props: IFloatingFilterParams) {
  const parentValue =
    (props.currentParentModel() as { filter?: string } | null)?.filter ?? '';
  const [value, setValue] = useState<string>(parentValue);

  // Reflect external filter changes (e.g. a filter reset) back into the input, the render-phase
  // way — React's recommended alternative to syncing with setState inside an effect.
  const [prevParentValue, setPrevParentValue] = useState<string>(parentValue);
  if (parentValue !== prevParentValue) {
    setPrevParentValue(parentValue);
    setValue(parentValue);
  }

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setValue(nextValue);

    const applyToParent = props.parentFilterInstance;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      applyToParent((instance) => {
        (instance as unknown as IFloatingFilterParent).onFloatingFilterChanged(
          'contains',
          nextValue,
        );
      });
    }, DEBOUNCE_MS);
  };

  return (
    <div className="border-primary text-secondary flex h-[23px] w-full flex-row items-center self-center rounded border pl-2">
      <IconSearch size={12} className="shrink-0" />
      <input
        type="text"
        className="w-full border-0 bg-transparent px-3 py-2 text-xs outline-none"
        value={value}
        onChange={onChange}
        placeholder="Search"
        aria-label="Filter column"
      />
    </div>
  );
}
