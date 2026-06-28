import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Plugin configuration audit trail
  await db.schema
    .createTable('plugin_audit_logs')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('plugin_id', 'text', (col) => col.notNull())
    .addColumn('action', 'text', (col) => col.notNull())
    .addColumn('old_config', 'jsonb')
    .addColumn('new_config', 'jsonb')
    .addColumn('performed_by', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('ip_address', sql`inet`)
    .addColumn('user_agent', 'text')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute()

  // Create indexes
  await db.schema
    .createIndex('idx_plugin_audit_workspace')
    .on('plugin_audit_logs')
    .column('workspace_id')
    .execute()

  await db.schema
    .createIndex('idx_plugin_audit_plugin')
    .on('plugin_audit_logs')
    .column('plugin_id')
    .execute()

  await db.schema
    .createIndex('idx_plugin_audit_created')
    .on('plugin_audit_logs')
    .column('created_at')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('plugin_audit_logs').execute()
}
