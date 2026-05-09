import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('audit')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('actor_id', 'uuid')
    .addColumn('actor_type', 'varchar', (col) =>
      col.notNull().defaultTo('user'),
    )
    .addColumn('event', 'varchar', (col) => col.notNull())
    .addColumn('resource_type', 'varchar', (col) => col.notNull())
    .addColumn('resource_id', 'uuid')
    .addColumn('space_id', 'uuid')
    .addColumn('changes', 'jsonb')
    .addColumn('metadata', 'jsonb')
    .addColumn('ip_address', sql`inet`)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_audit_workspace_id')
    .ifNotExists()
    .on('audit')
    .columns(['workspace_id', 'id desc'])
    .execute();

  // add new workspace columns
  await db.schema
    .alterTable('workspaces')
    .addColumn('audit_retention_days', 'int8', (col) => col)
    .execute();

  await db.schema
    .alterTable('workspaces')
    .addColumn('trash_retention_days', 'int8', (col) => col)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspaces')
    .dropColumn('audit_retention_days')
    .execute();

  await db.schema
    .alterTable('workspaces')
    .dropColumn('trash_retention_days')
    .execute();

  await db.schema.dropTable('audit').execute();
}
