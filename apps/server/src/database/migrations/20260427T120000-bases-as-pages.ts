import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // ----- pages: add is_base + base_schema_version --------------------------
  await db.schema
    .alterTable('pages')
    .addColumn('is_base', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();

  await db.schema
    .alterTable('pages')
    .addColumn('base_schema_version', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .execute();

  // Partial index for the (rare) "list all bases in space" query.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_pages_is_base
      ON pages (space_id, position COLLATE "C")
      WHERE is_base = true AND deleted_at IS NULL
  `.execute(db);

  // ----- Drop dev-only base data and tables -------------------------------
  // Triggers / functions referencing base_id must go before dropping tables.
  await sql`DROP TRIGGER IF EXISTS base_rows_search_update ON base_rows`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_rows_search_trigger()`.execute(db);
  await sql`DROP FUNCTION IF EXISTS build_base_row_search_text(jsonb, uuid)`.execute(db);

  await db.schema.dropTable('base_views').ifExists().execute();
  await db.schema.dropTable('base_rows').ifExists().execute();
  await db.schema.dropTable('base_properties').ifExists().execute();
  await db.schema.dropTable('bases').ifExists().execute();

  // ----- Recreate child tables with page_id -------------------------------
  await db.schema
    .createTable('base_properties')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('position', 'varchar', (col) => col.notNull())
    .addColumn('type_options', 'jsonb')
    .addColumn('is_primary', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('schema_version', 'integer', (col) =>
      col.notNull().defaultTo(1),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_properties_page_id
      ON base_properties (page_id)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_properties_page_alive
      ON base_properties (page_id, position COLLATE "C", id)
      WHERE deleted_at IS NULL
  `.execute(db);

  // Property-name uniqueness per base (preserve from earlier migration).
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_base_properties_page_name_alive
      ON base_properties (page_id, lower(name))
      WHERE deleted_at IS NULL
  `.execute(db);

  await db.schema
    .createTable('base_rows')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('cells', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn('position', 'varchar', (col) => col.notNull())
    .addColumn('search_text', 'text')
    .addColumn('search_tsv', sql`tsvector`)
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('last_updated_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await db.schema
    .createTable('base_views')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull().defaultTo('table'))
    .addColumn('position', 'varchar', (col) => col.notNull())
    .addColumn('config', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_base_views_page_id ON base_views (page_id)`.execute(db);

  // ----- Indexes on base_rows (page_id replaces base_id) ------------------
  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_cells_gin_path_ops
      ON base_rows USING gin (cells jsonb_path_ops)
      WHERE deleted_at IS NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_cells_gin_keys
      ON base_rows USING gin (cells)
      WHERE deleted_at IS NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_page_alive
      ON base_rows (page_id, position COLLATE "C", id)
      WHERE deleted_at IS NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_page_updated
      ON base_rows (page_id, updated_at DESC)
      WHERE deleted_at IS NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_page_created
      ON base_rows (page_id, created_at DESC)
      WHERE deleted_at IS NULL
  `.execute(db);

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

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_rows_workspace
      ON base_rows (workspace_id, page_id)
  `.execute(db);

  // ----- PG functions & trigger (rebuilt with page_id) --------------------
  await sql`
    CREATE OR REPLACE FUNCTION build_base_row_search_text(
      _cells jsonb,
      _page_id uuid
    ) RETURNS text
    LANGUAGE plpgsql STABLE PARALLEL SAFE
    AS $$
      DECLARE
        _parts text[] := ARRAY[]::text[];
        _prop jsonb;
        _value text;
        _arr jsonb;
        _elem jsonb;
        _resolved text;
        _cache_key text;
        _cached text;
        _props jsonb;
      BEGIN
        IF _cells IS NULL OR _cells = '{}'::jsonb OR _page_id IS NULL THEN
          RETURN NULL;
        END IF;

        _cache_key := 'bases.prop_cache_' || replace(_page_id::text, '-', '_');
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
            WHERE page_id = _page_id AND deleted_at IS NULL;
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

  await sql`
    CREATE OR REPLACE FUNCTION base_rows_search_trigger() RETURNS trigger
    LANGUAGE plpgsql AS $$
      BEGIN
        NEW.search_text := build_base_row_search_text(NEW.cells, NEW.page_id);
        NEW.search_tsv := to_tsvector('english', coalesce(NEW.search_text, ''));
        RETURN NEW;
      END;
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE TRIGGER base_rows_search_update
      BEFORE INSERT OR UPDATE ON base_rows
      FOR EACH ROW EXECUTE FUNCTION base_rows_search_trigger()
  `.execute(db);

  // ----- Cell extractors (unchanged signatures, reused) -------------------
  // base_cell_text/numeric/timestamptz/bool/array were created in
  // bases-hardening; they take (cells jsonb, prop uuid) and don't reference
  // base_id, so they survive untouched. Re-create here defensively in case
  // the down() of bases-hardening ran.
  await sql`
    CREATE OR REPLACE FUNCTION base_cell_text(cells jsonb, prop uuid)
    RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$ SELECT cells->>prop::text $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_numeric(cells jsonb, prop uuid)
    RETURNS numeric LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
      BEGIN RETURN (cells->>prop::text)::numeric;
      EXCEPTION WHEN others THEN RETURN NULL; END;
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_timestamptz(cells jsonb, prop uuid)
    RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
      BEGIN RETURN (cells->>prop::text)::timestamptz;
      EXCEPTION WHEN others THEN RETURN NULL; END;
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_bool(cells jsonb, prop uuid)
    RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
      BEGIN RETURN (cells->>prop::text)::boolean;
      EXCEPTION WHEN others THEN RETURN NULL; END;
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_array(cells jsonb, prop uuid)
    RETURNS jsonb LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$ SELECT cells->prop::text $$
  `.execute(db);

  // jsonb_set_many helper (unchanged from bases-hardening).
  await sql`
    CREATE OR REPLACE FUNCTION jsonb_set_many(target jsonb, patches jsonb)
    RETURNS jsonb LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    AS $$
      DECLARE k text; v jsonb; result jsonb := coalesce(target, '{}'::jsonb);
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
}

export async function down(db: Kysely<any>): Promise<void> {
  // Dev-only: drop everything we created.
  await sql`DROP TRIGGER IF EXISTS base_rows_search_update ON base_rows`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_rows_search_trigger()`.execute(db);
  await sql`DROP FUNCTION IF EXISTS build_base_row_search_text(jsonb, uuid)`.execute(db);

  await db.schema.dropTable('base_views').ifExists().execute();
  await db.schema.dropTable('base_rows').ifExists().execute();
  await db.schema.dropTable('base_properties').ifExists().execute();

  await sql`DROP INDEX IF EXISTS idx_pages_is_base`.execute(db);
  await db.schema.alterTable('pages').dropColumn('base_schema_version').execute();
  await db.schema.alterTable('pages').dropColumn('is_base').execute();
}
