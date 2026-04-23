// Matches the UUID regex pattern in `loader-sql.ts`. We use a handwritten
// regex rather than importing `validate` from the `uuid` package because
// that package is ESM-only and Jest's ts-jest config cannot transform it
// in this repo.
const UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const UUID_DASHES = /-/g;

/*
 * Turns a base UUID into a DuckDB-safe schema name.
 *
 *   '019c69a5-1d84-7985-a7f6-8ee2871d8669'
 *   -> 'b_019c69a51d847985a7f68ee2871d8669'
 *
 * The `b_` prefix is required because DuckDB unquoted identifiers must start
 * with a letter or underscore — a bare hex UUID starts with a digit and would
 * have to be double-quoted everywhere. The strip-dashes step makes the rest
 * of the identifier hex-only, which is always safe.
 *
 * All attached database names, `DETACH DATABASE` targets, and schema-qualified
 * references (`<schema>.rows`) run through this function. Validation is
 * strict: if the input isn't a real UUID, we throw rather than produce a
 * "safe-looking" identifier that might leak through to user-facing SQL.
 */
export function baseSchemaName(baseId: string): string {
  if (!UUID.test(baseId)) {
    throw new Error(`Invalid base id "${baseId}"`);
  }
  return `b_${baseId.toLowerCase().replace(UUID_DASHES, '')}`;
}
