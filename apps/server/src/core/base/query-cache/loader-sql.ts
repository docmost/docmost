import { validate as isValidUUID } from 'uuid';

import { ColumnSpec } from './query-cache.types';

/*
 * Pure SQL builder for the cold-load query executed by DuckDB's postgres
 * extension against the attached Postgres database.
 *
 * The outer statement is a DuckDB `CREATE TABLE ... AS SELECT * FROM
 * postgres_query('pg', $pgsql$ ... $pgsql$)`. `postgres_query` ships the
 * raw inner SQL to Postgres and returns typed rows; this is the only way
 * to invoke custom Postgres UDFs (`base_cell_text`, etc.) because DuckDB's
 * postgres extension does not push unknown scalar functions down — it
 * would otherwise try to evaluate them locally and fail.
 *
 * Design notes:
 *
 *   - Inside `postgres_query`, the table is native `base_rows` (no `pg.`
 *     schema prefix — that prefix is DuckDB's ATTACH alias, not visible
 *     to Postgres).
 *
 *   - Every SYSTEM_COLUMN maps directly onto a column in `base_rows`.
 *     UUID columns cast to text so they land in DuckDB's VARCHAR column.
 *
 *   - User columns delegate to the Postgres helper functions defined in
 *     migration 20260417T120000 (`base_cell_text`, `base_cell_numeric`,
 *     `base_cell_timestamptz`, `base_cell_bool`).
 *
 *   - JSON columns (multi-select, file, multi-person) are passed as raw JSON
 *     text (`(cells -> 'uuid')::text`). DuckDB's JSON column accepts that.
 *
 *   - `baseId` and `workspaceId` are interpolated directly as single-quoted
 *     UUID literals inside the inner SQL. They are UUID-validated before
 *     interpolation; UUID-shape is the only thing that makes inlining safe.
 *
 *   - Identifiers are validated before interpolation. `ColumnSpec.column` is
 *     always a UUID or snake_case system name; the regex catches any
 *     programming mistake that would otherwise break SQL quoting.
 */
export function buildLoaderSql(
  specs: ColumnSpec[],
  baseId: string,
  workspaceId: string,
): string {
  if (!isValidUUID(baseId)) {
    throw new Error(`Invalid base id "${baseId}"`);
  }
  if (!isValidUUID(workspaceId)) {
    throw new Error(`Invalid workspace id "${workspaceId}"`);
  }
  const projections = specs.map((spec) => projectionFor(spec));
  return [
    'CREATE TABLE rows AS',
    "SELECT * FROM postgres_query('pg', $pgsql$",
    '  SELECT',
    '    ' + projections.join(',\n    '),
    '  FROM base_rows',
    `  WHERE base_id = '${baseId}'::uuid`,
    `    AND workspace_id = '${workspaceId}'::uuid`,
    '    AND deleted_at IS NULL',
    '$pgsql$)',
  ].join('\n');
}

function projectionFor(spec: ColumnSpec): string {
  validateColumnName(spec.column);
  const qid = `"${spec.column}"`;

  // System columns — fixed mapping onto base_rows.
  switch (spec.column) {
    case 'id':                 return 'id::text AS id';
    case 'base_id':            return 'base_id::text AS base_id';
    case 'workspace_id':       return 'workspace_id::text AS workspace_id';
    case 'creator_id':         return 'creator_id::text AS creator_id';
    case 'position':           return 'position';
    case 'created_at':         return 'created_at';
    case 'updated_at':         return 'updated_at';
    case 'last_updated_by_id': return 'last_updated_by_id::text AS last_updated_by_id';
    case 'deleted_at':         return 'deleted_at';
    case 'search_text':        return "''::VARCHAR AS search_text";
  }

  // User columns.
  const prop = spec.property;
  if (!prop) {
    throw new Error(
      `ColumnSpec for "${spec.column}" has no property; cannot project`,
    );
  }

  const id = prop.id;
  validateUuid(id);

  switch (spec.ddlType) {
    case 'VARCHAR':
      // TEXT, URL, EMAIL, SELECT, STATUS, single-PERSON all map to VARCHAR.
      return `base_cell_text(cells, '${id}'::uuid) AS ${qid}`;
    case 'DOUBLE':
      return `base_cell_numeric(cells, '${id}'::uuid) AS ${qid}`;
    case 'TIMESTAMPTZ':
      return `base_cell_timestamptz(cells, '${id}'::uuid) AS ${qid}`;
    case 'BOOLEAN':
      return `base_cell_bool(cells, '${id}'::uuid) AS ${qid}`;
    case 'JSON':
      // MULTI_SELECT / FILE / multi-PERSON.
      return `(cells -> '${id}')::text AS ${qid}`;
    default: {
      const _never: never = spec.ddlType;
      throw new Error(`Unknown DuckDbDdlType: ${_never}`);
    }
  }
}

const VALID_COL = /^[a-zA-Z0-9_\-]+$/;
function validateColumnName(name: string): void {
  if (!VALID_COL.test(name)) {
    throw new Error(`Invalid column name "${name}"`);
  }
}

function validateUuid(s: string): void {
  if (!isValidUUID(s)) {
    throw new Error(`Invalid property UUID "${s}"`);
  }
}
