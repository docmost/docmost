import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // --- Columns -----------------------------------------------------------

  await sql`
    ALTER TABLE base_rows
      ADD COLUMN IF NOT EXISTS search_text text,
      ADD COLUMN IF NOT EXISTS search_tsv  tsvector
  `.execute(db);

  await sql`
    ALTER TABLE base_properties
      ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS deleted_at     timestamptz
  `.execute(db);

  await sql`
    ALTER TABLE bases
      ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1
  `.execute(db);

  // --- Schema-on-read extractors ----------------------------------------
  // Coercion-safe: uncoercible values return NULL, never raise.
  // IMMUTABLE so the planner can inline them into expression indexes later.

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_text(cells jsonb, prop uuid)
    RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$ SELECT cells->>prop::text $$
  `.execute(db);

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

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_array(cells jsonb, prop uuid)
    RETURNS jsonb
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$ SELECT cells->prop::text $$
  `.execute(db);

  // --- Surgical JSONB patch (vs. whole-blob `||`) -----------------------

  await sql`
    CREATE OR REPLACE FUNCTION jsonb_set_many(target jsonb, patches jsonb)
    RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    AS $$
      DECLARE
        k text;
        v jsonb;
        result jsonb := coalesce(target, '{}'::jsonb);
      BEGIN
        IF patches IS NULL OR jsonb_typeof(patches) <> 'object' THEN
          RETURN result;
        END IF;
        FOR k, v IN SELECT * FROM jsonb_each(patches) LOOP
          IF v = 'null'::jsonb THEN
            result := result - k;
          ELSE
            result := jsonb_set(result, ARRAY[k], v, true);
          END IF;
        END LOOP;
        RETURN result;
      END;
    $$
  `.execute(db);

  // --- Search text builder (select/multiSelect resolved to choice names) --
  // STABLE (not IMMUTABLE) because it reads base_properties.
  //
  // Transaction-scoped cache: the property list for a given base_id is
  // read once per transaction and cached via a local GUC. Bulk writes
  // (CSV import, batch cell update, trigger on N rows) share one lookup
  // instead of subquerying base_properties per row.

  await sql`
    CREATE OR REPLACE FUNCTION build_base_row_search_text(
      _cells jsonb,
      _base_id uuid
    ) RETURNS text
    LANGUAGE plpgsql STABLE PARALLEL SAFE
    AS $$
      DECLARE
        _parts text[] := ARRAY[]::text[];
        _prop  jsonb;
        _value text;
        _arr   jsonb;
        _elem  jsonb;
        _resolved text;
        _cache_key text;
        _cached    text;
        _props     jsonb;
      BEGIN
        IF _cells IS NULL OR _cells = '{}'::jsonb OR _base_id IS NULL THEN
          RETURN NULL;
        END IF;

        -- Transaction-scoped cache of the base's property list.
        _cache_key := 'bases.prop_cache_' || replace(_base_id::text, '-', '_');
        _cached := current_setting(_cache_key, true);
        IF _cached IS NULL OR _cached = '' THEN
          SELECT coalesce(
            jsonb_agg(jsonb_build_object(
              'id', id,
              'type', type,
              'type_options', type_options
            )),
            '[]'::jsonb
          )
            INTO _props
            FROM base_properties
            WHERE base_id = _base_id AND deleted_at IS NULL;
          PERFORM set_config(_cache_key, _props::text, true);
        ELSE
          _props := _cached::jsonb;
        END IF;

        FOR _prop IN SELECT * FROM jsonb_array_elements(_props)
        LOOP
          IF (_prop->>'type') IN ('text', 'url', 'email') THEN
            _value := _cells->>(_prop->>'id');
            IF _value IS NOT NULL AND _value <> '' THEN
              _parts := array_append(_parts, _value);
            END IF;

          ELSIF (_prop->>'type') IN ('select', 'status') THEN
            _value := _cells->>(_prop->>'id');
            IF _value IS NOT NULL AND _value <> '' THEN
              SELECT c->>'name' INTO _resolved
                FROM jsonb_array_elements(coalesce(_prop->'type_options'->'choices', '[]'::jsonb)) AS c
                WHERE c->>'id' = _value
                LIMIT 1;
              IF _resolved IS NOT NULL AND _resolved <> '' THEN
                _parts := array_append(_parts, _resolved);
              END IF;
            END IF;

          ELSIF (_prop->>'type') = 'multiSelect' THEN
            _arr := _cells->(_prop->>'id');
            IF jsonb_typeof(_arr) = 'array' THEN
              FOR _elem IN SELECT * FROM jsonb_array_elements(_arr)
              LOOP
                SELECT c->>'name' INTO _resolved
                  FROM jsonb_array_elements(coalesce(_prop->'type_options'->'choices', '[]'::jsonb)) AS c
                  WHERE c->>'id' = _elem#>>'{}'
                  LIMIT 1;
                IF _resolved IS NOT NULL AND _resolved <> '' THEN
                  _parts := array_append(_parts, _resolved);
                END IF;
              END LOOP;
            END IF;
          END IF;
        END LOOP;

        IF array_length(_parts, 1) IS NULL THEN
          RETURN NULL;
        END IF;

        RETURN f_unaccent(array_to_string(_parts, ' '));
      END;
    $$
  `.execute(db);

  // --- Row search trigger -----------------------------------------------

  await sql`
    CREATE OR REPLACE FUNCTION base_rows_search_trigger() RETURNS trigger
    LANGUAGE plpgsql AS $$
      BEGIN
        NEW.search_text := build_base_row_search_text(NEW.cells, NEW.base_id);
        NEW.search_tsv  := to_tsvector('english', coalesce(NEW.search_text, ''));
        RETURN NEW;
      END;
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE TRIGGER base_rows_search_update
      BEFORE INSERT OR UPDATE ON base_rows
      FOR EACH ROW EXECUTE FUNCTION base_rows_search_trigger()
  `.execute(db);

  // --- Indexes ----------------------------------------------------------

  // Replace the default-opclass GIN created by the initial bases migration
  // with the smaller/faster jsonb_path_ops variant. No row-data backfill:
  // this branch is dev-only; the trigger populates search_text /
  // search_tsv on the next write to each row.
  await sql`DROP INDEX IF EXISTS idx_base_rows_cells_gin`.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_cells_gin_path_ops
      ON base_rows USING gin (cells jsonb_path_ops)
      WHERE deleted_at IS NULL
  `.execute(db);

  // Complementary default-opclass GIN so the `?` / `?|` / `?&` key-existence
  // operators are index-satisfiable — `jsonb_path_ops` above only covers
  // `@>`. Type-conversion and cell-GC paths filter `cells ? propertyId`;
  // without this the planner falls back to SEQ SCAN (~900ms on 100k rows).
  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_cells_gin_keys
      ON base_rows USING gin (cells)
      WHERE deleted_at IS NULL
  `.execute(db);

  // Workhorse for paginated list: (base_id, position, id) on live rows.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_base_alive
      ON base_rows (base_id, position COLLATE "C", id)
      WHERE deleted_at IS NULL
  `.execute(db);

  // Common "most recently edited" sort.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_base_updated
      ON base_rows (base_id, updated_at DESC)
      WHERE deleted_at IS NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_base_created
      ON base_rows (base_id, created_at DESC)
      WHERE deleted_at IS NULL
  `.execute(db);

  // Fulltext + trigram search indexes.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_search_tsv
      ON base_rows USING gin (search_tsv)
      WHERE deleted_at IS NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_search_trgm
      ON base_rows USING gin (search_text gin_trgm_ops)
      WHERE deleted_at IS NULL
  `.execute(db);

  // Tenant-scoped scans defense-in-depth.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_workspace
      ON base_rows (workspace_id, base_id)
  `.execute(db);

  // Live properties per base (deleted_at partial).
  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_properties_base_alive
      ON base_properties (base_id, position COLLATE "C", id)
      WHERE deleted_at IS NULL
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // --- Drop new indexes -------------------------------------------------
  await sql`DROP INDEX IF EXISTS idx_base_properties_base_alive`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_base_rows_workspace`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_base_rows_search_trgm`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_base_rows_search_tsv`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_base_rows_base_created`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_base_rows_base_updated`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_base_rows_base_alive`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_base_rows_cells_gin_keys`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_base_rows_cells_gin_path_ops`.execute(db);

  // Restore the original GIN that the initial bases migration created.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_cells_gin
      ON base_rows USING gin (cells)
  `.execute(db);

  // --- Drop trigger, trigger fn, helpers --------------------------------
  await sql`DROP TRIGGER IF EXISTS base_rows_search_update ON base_rows`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_rows_search_trigger()`.execute(db);
  await sql`DROP FUNCTION IF EXISTS build_base_row_search_text(jsonb, uuid)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS jsonb_set_many(jsonb, jsonb)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_cell_array(jsonb, uuid)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_cell_bool(jsonb, uuid)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_cell_timestamptz(jsonb, uuid)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_cell_numeric(jsonb, uuid)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_cell_text(jsonb, uuid)`.execute(db);

  // --- Drop columns -----------------------------------------------------
  await sql`ALTER TABLE bases DROP COLUMN IF EXISTS schema_version`.execute(db);
  await sql`
    ALTER TABLE base_properties
      DROP COLUMN IF EXISTS deleted_at,
      DROP COLUMN IF EXISTS schema_version
  `.execute(db);
  await sql`
    ALTER TABLE base_rows
      DROP COLUMN IF EXISTS search_tsv,
      DROP COLUMN IF EXISTS search_text
  `.execute(db);
}
