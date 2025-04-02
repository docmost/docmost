import { sql, Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_members')
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
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('role', 'varchar', (col) => col.notNull())
    .addColumn('added_by_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .addUniqueConstraint('page_members_page_id_user_id_unique', [
      'page_id',
      'user_id',
    ])
    .addUniqueConstraint('page_members_page_id_group_id_unique', [
      'page_id',
      'group_id',
    ])
    .addCheckConstraint(
      'allow_either_user_id_or_group_id_check',
      sql`(("user_id" IS NOT NULL AND "group_id" IS NULL) OR ("user_id" IS NULL AND "group_id" IS NOT NULL))`,
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('page_members').execute();
}
