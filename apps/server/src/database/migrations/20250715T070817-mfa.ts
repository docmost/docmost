import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('user_mfa')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('method', 'varchar', (col) => col.notNull().defaultTo('totp'))
    .addColumn('secret', 'text', (col) => col)
    .addColumn('is_enabled', 'boolean', (col) => col.defaultTo(false))
    .addColumn('backup_codes', sql`text[]`, (col) => col)
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('user_mfa_user_id_unique', ['user_id'])
    .execute();

  // Add MFA policy columns to workspaces
  await db.schema
    .alterTable('workspaces')
    .addColumn('enforce_mfa', 'boolean', (col) => col.defaultTo(false))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('workspaces').dropColumn('enforce_mfa').execute();

  await db.schema.dropTable('user_mfa').execute();
}
