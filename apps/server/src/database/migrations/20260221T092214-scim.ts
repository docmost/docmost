import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('scim_tokens')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('token_hash', 'varchar', (col) => col.notNull())
    .addColumn('token_last_four', 'varchar(4)', (col) => col.notNull())
    .addColumn('expires_at', 'timestamptz')
    .addColumn('last_used_at', 'timestamptz')
    .addColumn('is_enabled', 'boolean', (col) =>
      col.notNull().defaultTo(true),
    )
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
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('idx_scim_tokens_token_hash')
    .on('scim_tokens')
    .column('token_hash')
    .execute();

  await db.schema
    .createIndex('idx_scim_tokens_workspace_id')
    .on('scim_tokens')
    .column('workspace_id')
    .execute();

  await db.schema
    .alterTable('users')
    .addColumn('scim_external_id', 'text')
    .execute();

  await db.schema
    .createIndex('idx_users_workspace_scim_external_id')
    .on('users')
    .columns(['workspace_id', 'scim_external_id'])
    .where('scim_external_id', 'is not', null)
    .unique()
    .execute();

  await db.schema
    .alterTable('groups')
    .addColumn('scim_external_id', 'text')
    .execute();

  await db.schema
    .createIndex('idx_groups_workspace_scim_external_id')
    .on('groups')
    .columns(['workspace_id', 'scim_external_id'])
    .where('scim_external_id', 'is not', null)
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('scim_tokens').execute();

  await db.schema.dropIndex('idx_users_workspace_scim_external_id').execute();
  await db.schema
    .alterTable('users')
    .dropColumn('scim_external_id')
    .execute();

  await db.schema.dropIndex('idx_groups_workspace_scim_external_id').execute();
  await db.schema
    .alterTable('groups')
    .dropColumn('scim_external_id')
    .execute();
}
