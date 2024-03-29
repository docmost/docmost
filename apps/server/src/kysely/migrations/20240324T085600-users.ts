import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('name', 'varchar', (col) => col)
    .addColumn('email', 'varchar', (col) => col.notNull())
    .addColumn('emailVerifiedAt', 'timestamp', (col) => col)
    .addColumn('password', 'varchar', (col) => col.notNull())
    .addColumn('avatarUrl', 'varchar', (col) => col)
    .addColumn('role', 'varchar', (col) => col)
    .addColumn('status', 'varchar', (col) => col)
    .addColumn('workspaceId', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('locale', 'varchar', (col) => col)
    .addColumn('timezone', 'varchar', (col) => col)
    .addColumn('settings', 'jsonb', (col) => col)
    .addColumn('lastActiveAt', 'timestamp', (col) => col)
    .addColumn('lastLoginAt', 'timestamp', (col) => col)
    .addColumn('lastLoginIp', 'varchar', (col) => col)
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('users_email_workspaceId_unique', [
      'email',
      'workspaceId',
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .dropConstraint('users_workspaceId_fkey')
    .execute();

  await db.schema.dropTable('users').execute();
}
