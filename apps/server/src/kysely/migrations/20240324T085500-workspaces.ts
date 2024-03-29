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
    .addColumn('customDomain', 'varchar', (col) => col)
    .addColumn('enableInvite', 'boolean', (col) =>
      col.defaultTo(true).notNull(),
    )
    .addColumn('inviteCode', 'varchar', (col) => col)
    .addColumn('settings', 'jsonb', (col) => col)
    .addColumn('defaultRole', 'varchar', (col) =>
      col.defaultTo(UserRole.MEMBER).notNull(),
    )
    .addColumn('creatorId', 'uuid', (col) => col)
    .addColumn('defaultSpaceId', 'uuid', (col) => col)
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deletedAt', 'timestamp', (col) => col)
    .addUniqueConstraint('workspaces_hostname_unique', ['hostname'])
    .addUniqueConstraint('workspaces_inviteCode_unique', ['inviteCode'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('workspaces').execute();
}
