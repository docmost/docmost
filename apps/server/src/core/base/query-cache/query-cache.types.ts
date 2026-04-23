import type { BaseProperty } from '@docmost/db/types/entity.types';

export type DuckDbColumnType =
  | 'VARCHAR'
  | 'DOUBLE'
  | 'BOOLEAN'
  | 'TIMESTAMPTZ'
  | 'JSON';

export type ColumnSpec = {
  /*
   * The uuid of the property (user-defined props) or a stable literal
   * ('id', 'position', 'created_at', 'updated_at', 'last_updated_by_id',
   *  'deleted_at', 'search_text') for system columns.
   */
  column: string;
  ddlType: DuckDbColumnType;
  indexable: boolean;
  property?: Pick<BaseProperty, 'id' | 'type' | 'typeOptions'>;
};

/*
 * A base held in the shared DuckDB instance. Instead of owning a
 * `DuckDBInstance` and `DuckDBConnection`, it now just remembers the schema
 * name of its attached in-memory database. The runtime owns the actual
 * connections; this is pure metadata.
 */
export type LoadedCollection = {
  baseId: string;
  schema: string;       // e.g. "b_019c69a51d847985a7f68ee2871d8669"
  schemaVersion: number;
  columns: ColumnSpec[];
  lastAccessedAt: number;
  rowCount: number;
  /*
   * Estimated in-memory footprint, in bytes. DuckDB does not expose
   * per-attached-db memory accounting, so this is a rough heuristic
   * computed at load time: rowCount × columns.length × ~64 bytes. Used
   * for cache-size reporting; not for eviction decisions.
   */
  approxBytes: number;
};

export type ChangeEnvelope =
  | { kind: 'row-upsert'; baseId: string; row: Record<string, unknown> }
  | { kind: 'row-delete'; baseId: string; rowId: string }
  | { kind: 'rows-delete'; baseId: string; rowIds: string[] }
  | { kind: 'row-reorder'; baseId: string; rowId: string; position: string }
  | { kind: 'schema-invalidate'; baseId: string; schemaVersion: number };
