import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('audit_logs')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('actor_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('actor_type', 'varchar', (col) =>
      col.notNull().defaultTo('user'),
    )
    .addColumn('event', 'varchar', (col) => col.notNull())
    .addColumn('resource_type', 'varchar', (col) => col.notNull())
    .addColumn('resource_id', 'uuid')
    .addColumn('changes', 'jsonb')
    .addColumn('metadata', 'jsonb')
    .addColumn('ip_address', sql `inet`)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('audit_logs').execute();
}
