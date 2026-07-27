import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/documents/DocumentsGrid', () => ({
  DocumentsGrid: () => <div data-testid="documents-grid" />,
}));

import Home from '@/app/[lang]/page';

describe('Home', () => {
  it('renders the documents grid', () => {
    render(<Home />);
    expect(screen.getByTestId('documents-grid')).toBeInTheDocument();
  });
});
