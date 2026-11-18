import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('base_view_shares')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('key', 'varchar', (col) => col.notNull().unique())
    .addColumn('view_id', 'uuid', (col) =>
      col.references('base_views.id').onDelete('cascade').notNull().unique(),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('access', 'varchar', (col) => col.notNull().defaultTo('none'))
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

  await db.schema
    .createIndex('idx_base_view_shares_page_id')
    .on('base_view_shares')
    .column('page_id')
    .execute();

  await db.schema
    .createTable('base_pending_conversions')
    .addColumn('conversion_key', 'text', (col) => col.notNull())
    .addColumn('page_id', 'uuid', (col) =>
      col.notNull().references('pages.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint('base_pending_conversions_pkey', ['conversion_key', 'page_id'])
    .execute();

  await db.schema
    .createIndex('idx_base_pending_conversions_page_id')
    .on('base_pending_conversions')
    .column('page_id')
    .execute();

  // Snapshot bases that may contain legacy date/formula cells. Application
  // startup converts the list before this version serves requests or base jobs.
  // Old instances can still write legacy values after conversion.
  await sql`
    INSERT INTO base_pending_conversions (conversion_key, page_id, workspace_id)
    SELECT DISTINCT ON (page_id) 'date_values_v1', page_id, workspace_id
    FROM base_properties
    WHERE type IN ('date', 'formula') AND deleted_at IS NULL
    ORDER BY page_id
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Lossy: the end of a range is dropped, and formula cells keep the values the newer engine computed.
  await sql`
    UPDATE base_rows AS r
    SET cells = r.cells || coalesce((
      SELECT jsonb_object_agg(
        i.id,
        to_jsonb(CASE WHEN length(s.start) = 10 THEN s.start || 'T00:00:00.000Z' ELSE s.start END)
      )
      FROM unnest(d.ids) AS i(id)
      CROSS JOIN LATERAL (SELECT r.cells -> i.id ->> 'start' AS start OFFSET 0) AS s
      WHERE jsonb_typeof(r.cells -> i.id -> 'start') = 'string'
    ), '{}'::jsonb)
    FROM (
      SELECT page_id, array_agg(id) AS ids
      FROM base_properties
      WHERE type IN ('date', 'formula') AND deleted_at IS NULL
      GROUP BY page_id
    ) AS d
    WHERE r.page_id = d.page_id
      AND EXISTS (
        SELECT 1 FROM unnest(d.ids) AS i(id)
        WHERE jsonb_typeof(r.cells -> i.id -> 'start') = 'string'
      )
  `.execute(db);

  await sql`
    UPDATE base_properties
    SET type_options = jsonb_set(type_options, '{resultType}', '"date"')
    WHERE type = 'formula' AND type_options ->> 'resultType' = 'datetime'
  `.execute(db);
  await sql`
    UPDATE base_properties
    SET type_options = type_options - 'volatile'
    WHERE type = 'formula' AND type_options ? 'volatile'
  `.execute(db);
  await sql`
    UPDATE pages SET base_schema_version = base_schema_version + 1 WHERE is_base
  `.execute(db);

  // Last: dropping them locks pages, users, workspaces and base_views until commit.
  await db.schema.dropTable('base_pending_conversions').execute();
  await db.schema.dropTable('base_view_shares').execute();
}
