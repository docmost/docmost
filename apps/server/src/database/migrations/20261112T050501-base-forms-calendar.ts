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

  await db.schema.alterTable('pages').addColumn('base_time_zone', 'text').execute();
  await db.schema
    .alterTable('base_properties')
    .addColumn('cells_converted_at', 'timestamptz')
    .execute();

  await sql`DROP FUNCTION IF EXISTS base_cell_timestamptz(jsonb, text)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION base_cell_timestamptz(cells jsonb, prop text)
    RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
      BEGIN RETURN (cells->>prop::text)::timestamptz;
      EXCEPTION WHEN others THEN RETURN NULL; END;
    $$
  `.execute(db);
  await db.schema.alterTable('base_properties').dropColumn('cells_converted_at').execute();
  await db.schema.alterTable('pages').dropColumn('base_time_zone').execute();
  await db.schema.dropTable('base_view_shares').execute();
}
