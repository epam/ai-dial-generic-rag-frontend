/**
 * The document metadata schema returned by the channel `metadata` endpoint
 * (`/v1/deployments/{applicationId}/route/channel/metadata`). The `schema` is a JSON Schema
 * document describing each document's `metadata` map; `dimensions` enumerates the allowed values
 * for the filterable properties.
 */

/** A single property definition within the metadata JSON Schema (`schema.properties[key]`). */
export interface MetadataProperty {
  /** JSON Schema type, e.g. `"string"`, `"array"`. May be an array of types (e.g. `["string", "null"]`). */
  type?: string | string[];
  /** JSON Schema format hint, e.g. `"date"`, `"uri"` (dates are `type: "string"` + `format: "date"`). */
  format?: string;
  /** When `true`, the property is exposed as a document filter. */
  enable_filtering?: boolean;
  // Other JSON Schema keywords (items, enable_in_mcp_retrieve_chunks, …) pass through untyped.
  [key: string]: unknown;
}

/** The `schema` object of the channel metadata response — a JSON Schema describing document metadata. */
export interface DocumentMetadataSchema {
  $schema?: string;
  title?: string;
  type?: string;
  properties?: Record<string, MetadataProperty>;
  additionalProperties?: boolean;
}

/** Full response of the channel `metadata` endpoint. */
export interface ChannelMetadata {
  schema: DocumentMetadataSchema;
  /** Enumerated allowed values per filterable dimension (property key → values). */
  dimensions?: Record<string, string[]>;
}
