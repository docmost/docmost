import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Plugin configuration per workspace
  await db.schema
    .createTable('plugin_configurations')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('plugin_id', 'text', (col) =>
      col.notNull().references('plugin_definitions.id'),
    )
    .addColumn('enabled', 'boolean', (col) => col.defaultTo(false))
    .addColumn('config', 'jsonb')
    .addColumn('config_encrypted_fields', sql`text[]`)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('created_by', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('updated_by', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('version', 'integer', (col) => col.defaultTo(1))
    .addUniqueConstraint('unique_workspace_plugin', [
      'workspace_id',
      'plugin_id',
    ])
    .execute()

  // Create indexes
  await db.schema
    .createIndex('idx_plugin_configs_workspace')
    .on('plugin_configurations')
    .column('workspace_id')
    .execute()

  await db.schema
    .createIndex('idx_plugin_configs_plugin')
    .on('plugin_configurations')
    .column('plugin_id')
    .execute()

  await db.schema
    .createIndex('idx_plugin_configs_enabled')
    .on('plugin_configurations')
    .columns(['workspace_id', 'enabled'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('plugin_configurations').execute()
}
