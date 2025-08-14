import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_permissions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade'),
    )
    .addColumn('group_id', 'uuid', (col) =>
      col.references('groups.id').onDelete('cascade'),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.notNull().references('pages.id').onDelete('cascade'),
    )
    .addColumn('role', 'varchar', (col) => col.notNull())
    .addColumn('cascade', 'boolean', (col) => col.defaultTo(true).notNull()) // children can inherit
    .addColumn('added_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz')
    .addUniqueConstraint('unique_page_user', ['page_id', 'user_id'])
    .addUniqueConstraint('unique_page_group', ['page_id', 'group_id'])
    .addCheckConstraint(
      'allow_either_user_id_or_group_id_check',
      sql`(user_id IS NOT NULL AND group_id IS NULL) OR (user_id IS NULL AND group_id IS NOT NULL)`,
    )
    .execute();

  await db.schema
    .alterTable('pages')
    .addColumn('is_restricted', 'boolean', (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn('restricted_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .execute();

  // Add indexes for performance
  await db.schema
    .createIndex('idx_page_permissions_page_id')
    .on('page_permissions')
    .column('page_id')
    .execute();

  await db.schema
    .createIndex('idx_page_permissions_user_id')
    .on('page_permissions')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_page_permissions_group_id')
    .on('page_permissions')
    .column('group_id')
    .execute();

  // Create user_shared_pages table for tracking orphaned page access
  await db.schema
    .createTable('user_shared_pages')
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.notNull().references('pages.id').onDelete('cascade'),
    )
    .addColumn('shared_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint('user_shared_pages_pkey', ['user_id', 'page_id'])
    .execute();

  await db.schema
    .createIndex('idx_user_shared_pages_user_id')
    .on('user_shared_pages')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_user_shared_pages_shared_at')
    .on('user_shared_pages')
    .column('shared_at')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('pages').dropColumn('is_restricted').execute();
  await db.schema.alterTable('pages').dropColumn('restricted_by_id').execute();

  await db.schema.dropTable('user_shared_pages').execute();

  await db.schema.dropTable('page_permissions').execute();
}
