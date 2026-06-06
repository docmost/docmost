import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('organize_tasks')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade'),
    )
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('source', 'varchar', (col) => col.notNull().defaultTo('upload'))
    .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('open'))
    .addColumn('title', 'varchar', (col) => col)
    .addColumn('total', 'integer', (col) => col)
    .addColumn('completed', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('file_task_id', 'uuid', (col) => col)
    .addColumn('share_token', 'varchar', (col) => col.notNull().unique())
    .addColumn('error', 'text', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('organize_tasks_workspace_id_idx')
    .on('organize_tasks')
    .column('workspace_id')
    .execute();

  await db.schema
    .createTable('organize_events')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('organize_task_id', 'uuid', (col) =>
      col.references('organize_tasks.id').onDelete('cascade').notNull(),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('set null'),
    )
    .addColumn('title', 'varchar', (col) => col)
    .addColumn('step', 'varchar', (col) => col.notNull())
    .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('done'))
    .addColumn('detail', 'jsonb', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('organize_events_organize_task_id_idx')
    .on('organize_events')
    .column('organize_task_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('organize_events').execute();
  await db.schema.dropTable('organize_tasks').execute();
}
