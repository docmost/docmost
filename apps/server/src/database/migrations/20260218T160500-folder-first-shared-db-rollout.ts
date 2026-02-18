import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_node_meta')
    .addColumn('page_id', 'uuid', (col) =>
      col.primaryKey().references('pages.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('node_type', 'varchar', (col) => col.notNull().defaultTo('file'))
    .addColumn('is_pinned', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('pinned_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      'page_node_meta_node_type_check',
      sql`(node_type in ('file', 'folder'))`,
    )
    .execute();

  await db.schema
    .createIndex('page_node_meta_space_pin_idx')
    .on('page_node_meta')
    .columns(['space_id', 'is_pinned', 'pinned_at'])
    .execute();

  await db.schema
    .createIndex('page_node_meta_workspace_type_idx')
    .on('page_node_meta')
    .columns(['workspace_id', 'node_type'])
    .execute();

  await sql`
    insert into page_node_meta (
      page_id,
      workspace_id,
      space_id,
      node_type,
      is_pinned,
      created_at,
      updated_at
    )
    select
      p.id,
      p.workspace_id,
      p.space_id,
      case
        when exists (
          select 1
          from pages c
          where c.parent_page_id = p.id
            and c.deleted_at is null
        ) then 'folder'
        else 'file'
      end,
      false,
      now(),
      now()
    from pages p
    on conflict (page_id) do nothing
  `.execute(db);

  await db.schema
    .createTable('workspace_release_channel')
    .addColumn('workspace_id', 'uuid', (col) =>
      col.primaryKey().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('release_channel', 'varchar', (col) =>
      col.notNull().defaultTo('prod'),
    )
    .addColumn('updated_by', 'uuid', (col) => col.references('users.id'))
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      'workspace_release_channel_check',
      sql`(release_channel in ('prod', 'staging'))`,
    )
    .execute();

  await sql`
    insert into workspace_release_channel (workspace_id, release_channel, updated_at)
    select w.id, 'prod', now()
    from workspaces w
    on conflict (workspace_id) do nothing
  `.execute(db);

  await db.schema
    .createTable('folder_migration_jobs')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('pending'))
    .addColumn('total_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('success_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('failed_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_by', 'uuid', (col) => col.references('users.id'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      'folder_migration_jobs_status_check',
      sql`(status in ('pending', 'running', 'success', 'failed', 'rolled_back', 'canceled'))`,
    )
    .execute();

  await db.schema
    .createIndex('folder_migration_jobs_workspace_status_idx')
    .on('folder_migration_jobs')
    .columns(['workspace_id', 'status'])
    .execute();

  await db.schema
    .createTable('folder_migration_job_items')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('job_id', 'uuid', (col) =>
      col.references('folder_migration_jobs.id').onDelete('cascade').notNull(),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('old_parent_page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('set null'),
    )
    .addColumn('new_parent_page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('set null'),
    )
    .addColumn('old_position', 'varchar')
    .addColumn('new_position', 'varchar')
    .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('pending'))
    .addColumn('error_code', 'varchar')
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('folder_migration_job_items_job_page_unique', [
      'job_id',
      'page_id',
    ])
    .addCheckConstraint(
      'folder_migration_job_items_status_check',
      sql`(status in ('pending', 'success', 'failed', 'rolled_back'))`,
    )
    .execute();

  await db.schema
    .createIndex('folder_migration_job_items_job_status_idx')
    .on('folder_migration_job_items')
    .columns(['job_id', 'status'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('folder_migration_job_items').execute();
  await db.schema.dropTable('folder_migration_jobs').execute();
  await db.schema.dropTable('workspace_release_channel').execute();
  await db.schema.dropTable('page_node_meta').execute();
}
