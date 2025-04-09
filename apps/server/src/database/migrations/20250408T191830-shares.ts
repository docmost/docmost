import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('shares')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('slug_id', 'varchar', (col) => col.notNull())
    .addColumn('page_id', 'varchar', (col) => col.notNull())
    .addColumn('include_sub_pages', 'varchar', (col) => col)
    .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))

    // pageSlug

    //.addColumn('space_id', 'uuid', (col) =>
    //  col.references('spaces.id').onDelete('cascade').notNull(),
    // )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .addUniqueConstraint('shares_slug_id_unique', ['slug_id'])
    .execute();

  await db.schema
    .createIndex('shares_slug_id_idx')
    .on('shares')
    .column('slug_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('shares').execute();
}
