import { ColumnSpec } from './query-cache.types';

/*
 * Pure SQL builder for the cold-load query executed against the process-wide
 * DuckDB instance. The resulting SQL creates `<schema>.rows` inside the
 * attached in-memory database for the base, populated from Postgres via the
 * `postgres_query` function:
 *
 *   CREATE TABLE <schema>.rows AS
 *     SELECT * FROM postgres_query('pg', $pgsql$ ... $pgsql$);
 *
 * The inner SQL uses the Postgres helper functions (`base_cell_text`,
 * `base_cell_numeric`, `base_cell_timestamptz`, `base_cell_bool`) so JSONB
 * extraction happens server-side.
 *
 * Callers must pass a validated `schema` name (use `baseSchemaName()`).
 * Schema, baseId, and workspaceId are interpolated after validation: schema
 * is regex-checked and baseId/workspaceId are UUID-validated.
 */
export function buildLoaderSql(
  specs: ColumnSpec[],
  baseId: string,
  workspaceId: string,
  schema: string,
): string {
  if (!UUID.test(baseId)) {
    throw new Error(`Invalid base id "${baseId}"`);
  }
  if (!UUID.test(workspaceId)) {
    throw new Error(`Invalid workspace id "${workspaceId}"`);
  }
  validateSchema(schema);

  const projections = specs.map((spec) => projectionFor(spec));
  return [
    `CREATE TABLE ${schema}.rows AS`,
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

  const prop = spec.property;
  if (!prop) {
    throw new Error(
      `ColumnSpec for "${spec.column}" has no property; cannot project`,
    );
  }

  const id = prop.id;
  if (!UUID.test(id)) {
    throw new Error(`Invalid property UUID "${id}"`);
  }

  switch (spec.ddlType) {
    case 'VARCHAR':
      return `base_cell_text(cells, '${id}'::uuid) AS ${qid}`;
    case 'DOUBLE':
      return `base_cell_numeric(cells, '${id}'::uuid) AS ${qid}`;
    case 'TIMESTAMPTZ':
      return `base_cell_timestamptz(cells, '${id}'::uuid) AS ${qid}`;
    case 'BOOLEAN':
      return `base_cell_bool(cells, '${id}'::uuid) AS ${qid}`;
    case 'JSON':
      return `(cells -> '${id}')::text AS ${qid}`;
    default: {
      const _never: never = spec.ddlType;
      throw new Error(`Unknown DuckDbDdlType: ${_never}`);
    }
  }
}

const UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const VALID_COL = /^[a-zA-Z0-9_\-]+$/;
function validateColumnName(name: string): void {
  if (!VALID_COL.test(name)) {
    throw new Error(`Invalid column name "${name}"`);
  }
}

const VALID_SCHEMA = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function validateSchema(name: string): void {
  if (!VALID_SCHEMA.test(name)) {
    throw new Error(`Invalid schema name "${name}"`);
  }
}
