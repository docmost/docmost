import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // These functions previously used plpgsql + EXCEPTION blocks to catch bad
  // casts. EXCEPTION blocks require subtransactions, which Postgres cannot
  // use in parallel workers. The functions were marked PARALLEL SAFE but
  // aren't actually parallel-safe. DuckDB's postgres extension triggers
  // parallel COPY scans and fails on any row that invokes these.
  //
  // Rewrite each as a pure SQL function using jsonb_typeof + regex
  // validation to achieve the same "coerce-or-null" semantics without
  // plpgsql. SQL functions with no volatile side effects are genuinely
  // parallel-safe.

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_numeric(cells jsonb, prop uuid)
    RETURNS numeric
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
      SELECT CASE jsonb_typeof(cells -> prop::text)
        WHEN 'number' THEN (cells->>prop::text)::numeric
        WHEN 'string' THEN
          CASE WHEN (cells->>prop::text) ~ '^\\s*-?\\d+(\\.\\d+)?([eE][+-]?\\d+)?\\s*$'
               THEN (cells->>prop::text)::numeric
               ELSE NULL END
        ELSE NULL
      END
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_timestamptz(cells jsonb, prop uuid)
    RETURNS timestamptz
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
      SELECT CASE
        WHEN jsonb_typeof(cells -> prop::text) = 'string'
             AND (cells->>prop::text) ~ '^\\d{4}-\\d{2}-\\d{2}([ T]\\d{2}:\\d{2}(:\\d{2}(\\.\\d+)?)?([+-]\\d{2}(:?\\d{2})?|Z)?)?$'
        THEN (cells->>prop::text)::timestamptz
        ELSE NULL
      END
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_bool(cells jsonb, prop uuid)
    RETURNS boolean
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
      SELECT CASE jsonb_typeof(cells -> prop::text)
        WHEN 'boolean' THEN (cells->>prop::text)::boolean
        WHEN 'string' THEN
          CASE lower(cells->>prop::text)
            WHEN 'true'  THEN true
            WHEN 't'     THEN true
            WHEN 'yes'   THEN true
            WHEN 'y'     THEN true
            WHEN '1'     THEN true
            WHEN 'false' THEN false
            WHEN 'f'     THEN false
            WHEN 'no'    THEN false
            WHEN 'n'     THEN false
            WHEN '0'     THEN false
            ELSE NULL
          END
        ELSE NULL
      END
    $$
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Restore the previous plpgsql + EXCEPTION versions. Same PARALLEL SAFE
  // labels — they were broken before, they'll still be broken after rollback,
  // but rollback means you're going back to the prior bug not inventing a
  // new one.

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_numeric(cells jsonb, prop uuid)
    RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
      BEGIN
        RETURN (cells->>prop::text)::numeric;
      EXCEPTION WHEN others THEN
        RETURN NULL;
      END;
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_timestamptz(cells jsonb, prop uuid)
    RETURNS timestamptz
    LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
      BEGIN
        RETURN (cells->>prop::text)::timestamptz;
      EXCEPTION WHEN others THEN
        RETURN NULL;
      END;
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_bool(cells jsonb, prop uuid)
    RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
      BEGIN
        RETURN (cells->>prop::text)::boolean;
      EXCEPTION WHEN others THEN
        RETURN NULL;
      END;
    $$
  `.execute(db);
}
