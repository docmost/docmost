import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('scim_tokens')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())

    .addColumn('token', 'varchar', (col) => col.notNull())

    .addColumn('expires_at', 'timestamptz', (col) => col)

    .addColumn('last_used_at', 'timestamptz', (col) => col)
    .addColumn('allow_signup', 'boolean', (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn('is_enabled', 'boolean', (col) => col.defaultTo(false).notNull())

    .addColumn('creator_id', 'uuid', (col) =>
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
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .execute();

  await db.schema
    .alterTable('workspaces')
    .addColumn('is_scim_enabled', 'boolean', (col) =>
      col.defaultTo(false).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('scim_tokens').execute();

  await db.schema
    .alterTable('workspaces')
    .dropColumn('is_scim_enabled')
    .execute();
}
