import { Fragment, createElement } from 'react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  CalendarMode: { Date: 'date', DateTime: 'datetime' },
  Calendar: (props: Record<string, unknown>) =>
    createElement('calendar-stub', props),
}));

import { renderDateField } from '@/components/documents/render-date-field';

function primitiveDefaultElement(
  value: unknown,
  onChange: (value: unknown) => void,
): ReactElement {
  return createElement(
    Fragment,
    null,
    createElement('input-stub', { value, onChange }),
    createElement('error-stub'),
  );
}

describe('renderDateField', () => {
  it('returns the default element for a non-date format', () => {
    const defaultElement = primitiveDefaultElement('report', vi.fn());
    const result = renderDateField(
      ['publication_type'],
      { type: 'string' },
      defaultElement,
    );
    expect(result).toBe(defaultElement);
  });

  it('returns the default element when format is unrecognized', () => {
    const defaultElement = primitiveDefaultElement('x', vi.fn());
    const result = renderDateField(
      ['some_uri'],
      { type: 'string', format: 'uri' },
      defaultElement,
    );
    expect(result).toBe(defaultElement);
  });

  it('renders a Calendar in Date mode for format: "date", parsing the current value', () => {
    const defaultElement = primitiveDefaultElement('2026-08-07', vi.fn());
    const result = renderDateField(
      ['publication_date'],
      { type: 'string', format: 'date' },
      defaultElement,
    ) as ReactElement;

    expect(result.type).not.toBe(Fragment);
    const props = result.props as {
      mode: string;
      value: Date | null;
      onChange: (v: unknown) => void;
    };
    expect(props.mode).toBe('date');
    expect(props.value).toBeInstanceOf(Date);
    expect(props.value?.getFullYear()).toBe(2026);
    expect(props.value?.getMonth()).toBe(7);
    expect(props.value?.getDate()).toBe(7);
  });

  it('renders a Calendar in DateTime mode for format: "date-time"', () => {
    const defaultElement = primitiveDefaultElement(
      '2026-08-07T10:30:00Z',
      vi.fn(),
    );
    const result = renderDateField(
      ['published_at'],
      { type: 'string', format: 'date-time' },
      defaultElement,
    ) as ReactElement;

    const props = result.props as { mode: string };
    expect(props.mode).toBe('datetime');
  });

  it('forwards a selected date back through the original onChange as a formatted string', () => {
    const onChange = vi.fn();
    const defaultElement = primitiveDefaultElement(null, onChange);
    const result = renderDateField(
      ['publication_date'],
      { type: 'string', format: 'date' },
      defaultElement,
    ) as ReactElement;

    const props = result.props as { onChange: (v: unknown) => void };
    props.onChange(new Date(2026, 7, 7));

    expect(onChange).toHaveBeenCalledWith('2026-08-07');
  });

  it('applies a fieldClassName matching the metadata form field styling', () => {
    const defaultElement = primitiveDefaultElement('2026-08-07', vi.fn());
    const result = renderDateField(
      ['publication_date'],
      { type: 'string', format: 'date' },
      defaultElement,
    ) as ReactElement;

    const props = result.props as { fieldClassName?: string };
    expect(props.fieldClassName).toEqual(expect.stringContaining('rounded'));
    expect(props.fieldClassName).toEqual(expect.stringContaining('h-[40px]'));
  });

  it('falls back to the default element when its first child is not a React element', () => {
    const defaultElement = createElement(Fragment, null, 'plain text child');
    const result = renderDateField(
      ['x'],
      { type: 'string', format: 'date' },
      defaultElement,
    );
    expect(result).toBe(defaultElement);
  });
});
