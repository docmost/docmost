import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createType('base_property_scope')
    .asEnum(['baseRows', 'page'])
    .execute();

  // The two nullable ownership keys cannot serve as the logical replication identity.
  await sql`ALTER TABLE base_properties REPLICA IDENTITY FULL`.execute(db);
  await db.schema
    .alterTable('base_properties')
    .dropConstraint('base_properties_pkey')
    .execute();

  // Legacy Base queries look up data by page_id. Only Base data can have that owner.
  for (const table of ['base_properties', 'base_rows']) {
    await db.schema
      .alterTable(table)
      .alterColumn('page_id', (col) => col.dropNotNull())
      .addColumn('metadata_page_id', 'uuid', (col) =>
        col.references('pages.id').onDelete('cascade'),
      )
      .addColumn('scope', sql`base_property_scope`, (col) =>
        col.notNull().defaultTo('baseRows'),
      )
      .execute();
    await db.schema
      .alterTable(table)
      .addCheckConstraint(
        `${table}_scope_owner_check`,
        sql`(scope = 'baseRows' AND page_id IS NOT NULL AND metadata_page_id IS NULL)
          OR (scope = 'page' AND metadata_page_id IS NOT NULL AND page_id IS NULL)`,
      )
      .execute();
  }

  await db.schema
    .alterTable('base_properties')
    .addUniqueConstraint('base_properties_page_id_id_key', ['page_id', 'id'])
    .execute();
  await sql`
    CREATE UNIQUE INDEX base_properties_metadata_page_id_id_key
      ON base_properties (metadata_page_id, id)
      WHERE metadata_page_id IS NOT NULL
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX base_properties_metadata_page_name_alive_unique
      ON base_properties (metadata_page_id, lower(trim(name)))
      WHERE scope = 'page' AND deleted_at IS NULL
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX base_rows_page_values_alive_unique
      ON base_rows (metadata_page_id)
      WHERE scope = 'page' AND deleted_at IS NULL
  `.execute(db);
  // FK cascades also need to find soft-deleted metadata rows.
  await sql`
    CREATE INDEX base_rows_metadata_page_id_idx ON base_rows (metadata_page_id)
      WHERE metadata_page_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DELETE FROM base_rows WHERE scope = 'page'`.execute(db);
  await sql`DELETE FROM base_properties WHERE scope = 'page'`.execute(db);
  await db.schema
    .alterTable('base_properties')
    .dropConstraint('base_properties_page_id_id_key')
    .execute();
  for (const table of ['base_properties', 'base_rows']) {
    await db.schema
      .alterTable(table)
      .dropColumn('scope')
      .dropColumn('metadata_page_id')
      .alterColumn('page_id', (col) => col.setNotNull())
      .execute();
  }
  await db.schema
    .alterTable('base_properties')
    .addPrimaryKeyConstraint('base_properties_pkey', ['page_id', 'id'])
    .execute();
  await sql`ALTER TABLE base_properties REPLICA IDENTITY DEFAULT`.execute(db);
  await db.schema.dropType('base_property_scope').execute();
}
