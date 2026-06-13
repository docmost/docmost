import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('integration_connections')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('provider', 'varchar', (col) => col.notNull())
    .addColumn('access_token', 'text', (col) => col.notNull())
    .addColumn('refresh_token', 'text', (col) => col)
    .addColumn('expires_at', 'timestamptz', (col) => col)
    .addColumn('external_id', 'varchar', (col) => col)
    .addColumn('external_name', 'varchar', (col) => col)
    .addColumn('scope', 'varchar', (col) => col)
    .addColumn('metadata', 'jsonb', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint(
      'integration_connections_workspace_id_user_id_provider_unique',
      ['workspace_id', 'user_id', 'provider'],
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('integration_connections').execute();
}
