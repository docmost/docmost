import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('favorites')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade'),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade'),
    )
    .addColumn('template_id', 'uuid', (col) =>
      col.references('templates.id').onDelete('cascade'),
    )
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createIndex('idx_favorites_user_page')
    .on('favorites')
    .columns(['user_id', 'page_id'])
    .unique()
    .where('page_id', 'is not', null)
    .execute();

  await db.schema
    .createIndex('idx_favorites_user_space')
    .on('favorites')
    .columns(['user_id', 'space_id'])
    .unique()
    .where('space_id', 'is not', null)
    .execute();

  await db.schema
    .createIndex('idx_favorites_user_template')
    .on('favorites')
    .columns(['user_id', 'template_id'])
    .unique()
    .where('template_id', 'is not', null)
    .execute();

  await db.schema
    .createIndex('idx_favorites_user_workspace_type')
    .on('favorites')
    .columns(['user_id', 'workspace_id', 'type'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('favorites').execute();
}
