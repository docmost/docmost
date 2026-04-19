import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import type { BaseProperty } from '@docmost/db/types/entity.types';

export type DuckDbColumnType =
  | 'VARCHAR'
  | 'DOUBLE'
  | 'BOOLEAN'
  | 'TIMESTAMPTZ'
  | 'JSON';

export type ColumnSpec = {
  // The uuid of the property (user-defined props) or a stable literal
  // ('id', 'position', 'created_at', 'updated_at', 'last_updated_by_id',
  //  'deleted_at', 'search_text') for system columns.
  column: string;
  ddlType: DuckDbColumnType;
  indexable: boolean;
  // For user-defined props we keep the source BaseProperty so callers can
  // resolve the extraction rule from JSON.
  property?: Pick<BaseProperty, 'id' | 'type' | 'typeOptions'>;
};

export type LoadedCollection = {
  baseId: string;
  schemaVersion: number;
  columns: ColumnSpec[];
  instance: DuckDBInstance;
  connection: DuckDBConnection;
  lastAccessedAt: number;
};

export type ChangeEnvelope =
  | { kind: 'row-upsert'; baseId: string; row: Record<string, unknown> }
  | { kind: 'row-delete'; baseId: string; rowId: string }
  | { kind: 'rows-delete'; baseId: string; rowIds: string[] }
  | { kind: 'row-reorder'; baseId: string; rowId: string; position: string }
  | { kind: 'schema-invalidate'; baseId: string; schemaVersion: number };
