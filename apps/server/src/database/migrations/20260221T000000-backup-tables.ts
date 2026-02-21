import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createType('backup_job_status')
    .asEnum(['pending', 'running', 'success', 'failed', 'canceled'])
    .execute();

  await db.schema
    .createType('backup_trigger_type')
    .asEnum(['schedule', 'manual', 'api'])
    .execute();

  await db.schema
    .createTable('backup_policies')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('enabled', 'boolean', (col) => col.defaultTo(true).notNull())
    .addColumn('cron_expr', 'text', (col) => col.notNull())
    .addColumn('timezone', 'text', (col) => col.defaultTo('UTC').notNull())
    .addColumn('retention_days', 'integer', (col) => col)
    .addColumn('retention_count', 'integer', (col) => col)
    .addColumn('target_driver', 'text', (col) => col.notNull())
    .addColumn('target_config', 'jsonb', (col) => col)
    .addColumn('last_run_at', 'timestamptz', (col) => col)
    .addColumn('created_by', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable('backup_jobs')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('policy_id', 'uuid', (col) =>
      col.references('backup_policies.id').onDelete('set null'),
    )
    .addColumn('trigger_type', sql`backup_trigger_type`, (col) =>
      col.notNull(),
    )
    .addColumn('triggered_by_user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('status', sql`backup_job_status`, (col) => col.notNull())
    .addColumn('started_at', 'timestamptz', (col) => col)
    .addColumn('ended_at', 'timestamptz', (col) => col)
    .addColumn('duration_ms', 'bigint', (col) => col)
    .addColumn('artifact_path', 'text', (col) => col)
    .addColumn('artifact_size_bytes', 'bigint', (col) => col)
    .addColumn('checksum', 'text', (col) => col)
    .addColumn('error_code', 'text', (col) => col)
    .addColumn('error_message', 'text', (col) => col)
    .addColumn('metadata', 'jsonb', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createType('backup_restore_mode')
    .asEnum(['dry-run', 'apply'])
    .execute();

  await db.schema
    .createType('backup_restore_status')
    .asEnum(['pending', 'running', 'success', 'failed'])
    .execute();

  await db.schema
    .createTable('backup_restores')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('job_id', 'uuid', (col) =>
      col.references('backup_jobs.id').onDelete('set null'),
    )
    .addColumn('mode', sql`backup_restore_mode`, (col) => col.notNull())
    .addColumn('status', sql`backup_restore_status`, (col) => col.notNull())
    .addColumn('started_at', 'timestamptz', (col) => col)
    .addColumn('ended_at', 'timestamptz', (col) => col)
    .addColumn('report', 'jsonb', (col) => col)
    .addColumn('operator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('backup_jobs_workspace_id_created_at_idx')
    .on('backup_jobs')
    .columns(['workspace_id', 'created_at'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('backup_restores').execute();
  await db.schema.dropType('backup_restore_status').execute();
  await db.schema.dropType('backup_restore_mode').execute();
  await db.schema.dropTable('backup_jobs').execute();
  await db.schema.dropTable('backup_policies').execute();
  await db.schema.dropType('backup_trigger_type').execute();
  await db.schema.dropType('backup_job_status').execute();
}
