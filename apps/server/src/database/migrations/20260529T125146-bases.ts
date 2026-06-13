import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('pages')
    .addColumn('is_base', 'boolean', (col) =>
      col.ifNotExists().notNull().defaultTo(false),
    )
    .addColumn('base_schema_version', 'integer', (col) =>
      col.ifNotExists().notNull().defaultTo(0),
    )
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_pages_is_base
      ON pages (space_id, position COLLATE "C")
      WHERE is_base = true AND deleted_at IS NULL
  `.execute(db);

  await db.schema
    .createTable('base_properties')
    .ifNotExists()
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
    .addColumn('pending_type', 'varchar')
    .addColumn('pending_type_options', 'jsonb')
    .addColumn('pending_token', 'uuid')
    .addColumn('is_primary', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('schema_version', 'integer', (col) => col.notNull().defaultTo(1))
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

  await sql`CREATE INDEX IF NOT EXISTS idx_base_properties_page_id ON base_properties (page_id)`.execute(
    db,
  );

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_properties_page_alive
      ON base_properties (page_id, position COLLATE "C", id)
      WHERE deleted_at IS NULL
  `.execute(db);

  // Match the service-layer name check (name.trim().toLowerCase()) so
  // whitespace-padded duplicates also collide. Formulas look properties up by
  // name, so the names have to stay unique.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_base_properties_page_name_alive
      ON base_properties (page_id, lower(trim(name)))
      WHERE deleted_at IS NULL
  `.execute(db);

  await db.schema
    .createTable('base_rows')
    .ifNotExists()
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

  // Intentionally no GIN on cells: `cells ? key` lookups are rare and
  // page-scoped, while the index doubled the write cost of every cell edit.
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

  await db.schema
    .createTable('base_views')
    .ifNotExists()
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

  await sql`CREATE INDEX IF NOT EXISTS idx_base_views_page_id ON base_views (page_id)`.execute(
    db,
  );

  // Cell extraction helpers for filters and sorts. Return NULL for absent or
  // non-castable values.
  await sql`
    CREATE OR REPLACE FUNCTION base_cell_text(cells jsonb, prop uuid)
    RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$ SELECT cells->>prop::text $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_numeric(cells jsonb, prop uuid)
    RETURNS numeric LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
      SELECT CASE jsonb_typeof(cells->prop::text)
        WHEN 'number' THEN (cells->>prop::text)::numeric
        WHEN 'string' THEN
          CASE
            WHEN (cells->>prop::text) ~
              '^[[:space:]]*[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?[[:space:]]*$'
            THEN (cells->>prop::text)::numeric
          END
      END
    $$
  `.execute(db);

  // A DATE cell stores an arbitrary string (cell schema is z.string()), so the
  // cast can fail on values no regex can pre-validate (e.g. '2024-13-45'). This
  // helper uses plpgsql with an EXCEPTION handler to return NULL on failure.
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
    RETURNS boolean LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
      SELECT CASE jsonb_typeof(cells->prop::text)
        WHEN 'boolean' THEN (cells->>prop::text)::boolean
        WHEN 'string' THEN
          CASE
            WHEN lower(btrim(cells->>prop::text)) IN
              ('true','t','yes','y','on','1','false','f','no','n','off','0')
            THEN (cells->>prop::text)::boolean
          END
      END
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_array(cells jsonb, prop uuid)
    RETURNS jsonb LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$ SELECT cells->prop::text $$
  `.execute(db);

  // A null patch value deletes the key rather than storing a JSON null.
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

  // Resolves select/multiSelect cells to their choice names. The property list
  // per page is cached in a transaction-local setting so bulk writes look it up
  // once instead of per row.
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
    CREATE OR REPLACE TRIGGER base_rows_search_insert
      BEFORE INSERT ON base_rows
      FOR EACH ROW EXECUTE FUNCTION base_rows_search_trigger()
  `.execute(db);

  // Position-only reorders and metadata touches must not pay the
  // search_text recompute; OLD is not referenceable on INSERT, hence
  // the split triggers.
  await sql`
    CREATE OR REPLACE TRIGGER base_rows_search_update
      BEFORE UPDATE ON base_rows
      FOR EACH ROW
      WHEN (OLD.cells IS DISTINCT FROM NEW.cells)
      EXECUTE FUNCTION base_rows_search_trigger()
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('base_views').execute();
  await db.schema.dropTable('base_rows').execute();
  await db.schema.dropTable('base_properties').execute();

  await sql`DROP FUNCTION base_rows_search_trigger()`.execute(db);
  await sql`DROP FUNCTION build_base_row_search_text(jsonb, uuid)`.execute(db);
  await sql`DROP FUNCTION jsonb_set_many(jsonb, jsonb)`.execute(db);
  await sql`DROP FUNCTION base_cell_array(jsonb, uuid)`.execute(db);
  await sql`DROP FUNCTION base_cell_bool(jsonb, uuid)`.execute(db);
  await sql`DROP FUNCTION base_cell_timestamptz(jsonb, uuid)`.execute(db);
  await sql`DROP FUNCTION base_cell_numeric(jsonb, uuid)`.execute(db);
  await sql`DROP FUNCTION base_cell_text(jsonb, uuid)`.execute(db);

  await sql`DROP INDEX idx_pages_is_base`.execute(db);
  await db.schema
    .alterTable('pages')
    .dropColumn('base_schema_version')
    .dropColumn('is_base')
    .execute();
}
