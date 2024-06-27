import { Kysely, sql } from 'kysely';
import { UserRole } from '../../common/helpers/types/permission';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('workspaces')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('name', 'varchar', (col) => col)
    .addColumn('description', 'varchar', (col) => col)
    .addColumn('logo', 'varchar', (col) => col)
    .addColumn('hostname', 'varchar', (col) => col)
    .addColumn('custom_domain', 'varchar', (col) => col)
    .addColumn('settings', 'jsonb', (col) => col)
    .addColumn('default_role', 'varchar', (col) =>
      col.defaultTo(UserRole.MEMBER).notNull(),
    )
    .addColumn('email_domains', sql`varchar[]`, (col) => col.defaultTo('{}'))
    .addColumn('default_space_id', 'uuid', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .addUniqueConstraint('workspaces_hostname_unique', ['hostname'])
    .addUniqueConstraint('workspaces_custom_domain_unique', ['custom_domain'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('workspaces').execute();
}
