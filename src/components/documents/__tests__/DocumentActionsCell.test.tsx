import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DropdownTrigger: { Click: 'click' },
  DialGhostIconButton: (props: { 'aria-label'?: string }) => (
    <button aria-label={props['aria-label']}>menu</button>
  ),
  DialDropdown: (props: {
    items?: Array<{ key: string; label: ReactNode; onClick?: () => void }>;
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

import { DocumentActionsCell } from '@/components/documents/DocumentActionsCell';
import {
  DocumentActionsProvider,
  type DocumentActions,
} from '@/components/documents/DocumentActionsContext';
import type { Document } from '@/types/documents';

const DOC: Document = {
  id: 7,
  url: 'u',
  display_name: 'report.pdf',
  mime_type: 'application/pdf',
  size: 10,
  status: 'ready',
};

function renderCell(actions: DocumentActions, data: Document | undefined) {
  const params = { data } as unknown as Parameters<
    typeof DocumentActionsCell
  >[0];
  return render(
    <DocumentActionsProvider value={actions}>
      <DocumentActionsCell {...params} />
    </DocumentActionsProvider>,
  );
}

describe('DocumentActionsCell', () => {
  afterEach(() => {
    cleanup();
  });

  it('invokes the matching action handler with the row document', () => {
    const actions: DocumentActions = {
      onDownload: vi.fn(),
      onReindex: vi.fn(),
      onRequestDelete: vi.fn(),
    };
    renderCell(actions, DOC);

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reindex' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(actions.onDownload).toHaveBeenCalledWith(DOC);
    expect(actions.onReindex).toHaveBeenCalledWith(DOC);
    expect(actions.onRequestDelete).toHaveBeenCalledWith(DOC);
  });

  it('renders nothing when the row has no data', () => {
    renderCell(
      {
        onDownload: vi.fn(),
        onReindex: vi.fn(),
        onRequestDelete: vi.fn(),
      },
      undefined,
    );

    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });
});
