import { Kysely, sql } from 'kysely';
import { UserRole } from '../../helpers/types/permission';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('workspaces')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('name', 'varchar', (col) => col)
    .addColumn('description', 'text', (col) => col)
    .addColumn('logo', 'varchar', (col) => col)
    .addColumn('hostname', 'varchar', (col) => col)
    .addColumn('custom_domain', 'varchar', (col) => col)
    .addColumn('enable_invite', 'boolean', (col) =>
      col.defaultTo(true).notNull(),
    )
    .addColumn('invite_code', 'varchar', (col) =>
      col.defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('settings', 'jsonb', (col) => col)
    .addColumn('default_role', 'varchar', (col) =>
      col.defaultTo(UserRole.MEMBER).notNull(),
    )
    .addColumn('default_space_id', 'uuid', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .addUniqueConstraint('workspaces_hostname_unique', ['hostname'])
    .addUniqueConstraint('workspaces_invite_code_unique', ['invite_code'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('workspaces').execute();
}
