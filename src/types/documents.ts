export type DocumentStatus =
  'created' | 'processing' | 'processed' | 'indexing' | 'ready' | 'error';

export interface Document {
  id: number;
  url: string;
  display_name: string;
  mime_type: string;
  size: number;
  metadata?: Record<string, unknown>;
  status: DocumentStatus;
}

export interface PaginatedDocuments {
  total_count: number;
  offset: number;
  limit: number;
  results: Document[];
}
