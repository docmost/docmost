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
    .addColumn('id', 'varchar', (col) => col.notNull())
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
    .addPrimaryKeyConstraint('base_properties_pkey', ['page_id', 'id'])
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
    CREATE UNIQUE INDEX IF NOT EXISTS base_properties_page_name_alive_unique
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
    CREATE OR REPLACE FUNCTION base_cell_text(cells jsonb, prop text)
    RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$ SELECT cells->>prop::text $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_numeric(cells jsonb, prop text)
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
    CREATE OR REPLACE FUNCTION base_cell_timestamptz(cells jsonb, prop text)
    RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
      BEGIN RETURN (cells->>prop::text)::timestamptz;
      EXCEPTION WHEN others THEN RETURN NULL; END;
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_bool(cells jsonb, prop text)
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
    CREATE OR REPLACE FUNCTION base_cell_array(cells jsonb, prop text)
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
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('base_views').execute();
  await db.schema.dropTable('base_rows').execute();
  await db.schema.dropTable('base_properties').execute();

  await sql`DROP FUNCTION jsonb_set_many(jsonb, jsonb)`.execute(db);
  await sql`DROP FUNCTION base_cell_array(jsonb, text)`.execute(db);
  await sql`DROP FUNCTION base_cell_bool(jsonb, text)`.execute(db);
  await sql`DROP FUNCTION base_cell_timestamptz(jsonb, text)`.execute(db);
  await sql`DROP FUNCTION base_cell_numeric(jsonb, text)`.execute(db);
  await sql`DROP FUNCTION base_cell_text(jsonb, text)`.execute(db);

  await sql`DROP INDEX idx_pages_is_base`.execute(db);
  await db.schema
    .alterTable('pages')
    .dropColumn('base_schema_version')
    .dropColumn('is_base')
    .execute();
}
