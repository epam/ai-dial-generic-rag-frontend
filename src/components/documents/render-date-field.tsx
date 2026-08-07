import { isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Calendar, CalendarMode } from '@epam/ai-dial-ui-kit';
import type { JsonSchemaDef } from '@epam/ai-dial-ui-kit';

import {
  formatDateFieldValue,
  parseDateFieldValue,
} from '@/utils/documents/date-field';

const DATE_FORMATS = new Set(['date', 'date-time']);

const DATE_FIELD_CLASS_NAME =
  'rounded border-primary h-[40px] hover:border-accent-primary focus-within:border-focus';

interface PrimitiveFieldProps {
  value?: unknown;
  onChange?: (value: unknown) => void;
}

/**
 * `DialSchemaRenderer`'s `renderField` override: swaps the default text input for a `Calendar`
 * picker on `format: "date"`/`"date-time"` string fields, leaving every other field untouched.
 *
 * `renderField` doesn't receive the field's `value`/`onChange` directly, so this reads them off
 * `defaultElement`'s existing props (the `SchemaPrimitiveField` element ui-kit's
 * `SchemaFieldContent` builds internally, as `defaultElement`'s first child alongside its error
 * text). That's ui-kit's current internal element shape, not a typed/documented contract —
 * recheck this after any `ai-dial-ui-kit` upgrade that touches `SchemaFieldContent`.
 */
export function renderDateField(
  _path: string[],
  schema: JsonSchemaDef,
  defaultElement: ReactElement,
): ReactNode {
  const format = (schema as { format?: string }).format;
  if (!format || !DATE_FORMATS.has(format)) {
    return defaultElement;
  }

  const primitive = extractPrimitiveField(defaultElement);
  if (!primitive) {
    return defaultElement;
  }

  const { value, onChange } = primitive.props;

  return (
    <Calendar
      mode={format === 'date-time' ? CalendarMode.DateTime : CalendarMode.Date}
      value={parseDateFieldValue(value, format)}
      onChange={(next) => onChange?.(formatDateFieldValue(next, format))}
      fieldClassName={DATE_FIELD_CLASS_NAME}
    />
  );
}

function extractPrimitiveField(
  defaultElement: ReactElement,
): ReactElement<PrimitiveFieldProps> | null {
  const children = (defaultElement.props as { children?: ReactNode }).children;
  if (!Array.isArray(children)) {
    return null;
  }
  const candidate = children[0];
  return isValidElement<PrimitiveFieldProps>(candidate) ? candidate : null;
}
