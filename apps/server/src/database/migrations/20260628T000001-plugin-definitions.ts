import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Plugin definitions (what plugins are available)
  await db.schema
    .createTable('plugin_definitions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('version', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('author', 'text')
    .addColumn('config_schema', 'jsonb')
    .addColumn('required_permissions', sql`text[]`)
    .addColumn('hooks', sql`text[]`)
    .addColumn('backend_entry', 'text')
    .addColumn('backend_migrations', sql`text[]`)
    .addColumn('frontend_entry', 'text')
    .addColumn('frontend_assets', sql`text[]`)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz')
    .execute()

  // Create indexes
  await db.schema
    .createIndex('idx_plugin_definitions_id')
    .on('plugin_definitions')
    .column('id')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('plugin_definitions').execute()
}
