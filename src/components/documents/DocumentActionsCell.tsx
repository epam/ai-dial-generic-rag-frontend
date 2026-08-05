'use client';

import {
  DialDropdown,
  DialGhostIconButton,
  DropdownTrigger,
} from '@epam/ai-dial-ui-kit';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import type { ICellRendererParams } from 'ag-grid-community';

import { useDocumentActions } from '@/components/documents/DocumentActionsContext';
import type { Document } from '@/types/documents';

/** Inline vertical "⋮" glyph for the kebab trigger; no icon package is a dependency of this app. */
function KebabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

/** Rightmost per-row kebab (⋮) menu: Download, Export, Reindex, Delete. */
export function DocumentActionsCell({ data }: ICellRendererParams<Document>) {
  const { onDownload, onExport, onReindex, onRequestDelete } =
    useDocumentActions();

  if (!data) {
    return null;
  }

  const items: DropdownItem[] = [
    { key: 'download', label: 'Download', onClick: () => onDownload(data) },
    { key: 'export', label: 'Export', onClick: () => onExport(data) },
    { key: 'reindex', label: 'Reindex', onClick: () => onReindex(data) },
    {
      key: 'delete',
      label: 'Delete',
      danger: true,
      onClick: () => onRequestDelete(data),
    },
  ];

  return (
    <DialDropdown
      items={items}
      trigger={[DropdownTrigger.Click]}
      placement="bottom-end"
    >
      <DialGhostIconButton icon={<KebabIcon />} aria-label="Document actions" />
    </DialDropdown>
  );
}
