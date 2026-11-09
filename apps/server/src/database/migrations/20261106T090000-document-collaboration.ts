import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('document_tasks')
    .addColumn('id', 'uuid', (c) =>
      c.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (c) =>
      c.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('page_id', 'uuid', (c) =>
      c.references('pages.id').onDelete('set null'),
    )
    .addColumn('creator_id', 'uuid', (c) =>
      c.references('users.id').onDelete('set null'),
    )
    .addColumn('assignee_id', 'uuid', (c) =>
      c.references('users.id').onDelete('set null'),
    )
    .addColumn('title', 'varchar(200)', (c) => c.notNull())
    .addColumn('due_at', 'timestamptz')
    .addColumn('status', 'varchar(16)', (c) => c.notNull().defaultTo('pending'))
    .addColumn('completed_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      'document_task_status',
      sql`status in ('pending', 'completed', 'cancelled')`,
    )
    .addCheckConstraint(
      'document_task_completion',
      sql`(status = 'completed') = (completed_at is not null)`,
    )
    .addCheckConstraint('document_task_title', sql`length(trim(title)) > 0`)
    .execute();
  await db.schema
    .createIndex('document_tasks_personal')
    .on('document_tasks')
    .columns(['workspace_id', 'assignee_id', 'created_at'])
    .execute();
  await db.schema
    .createIndex('document_tasks_page')
    .on('document_tasks')
    .columns(['workspace_id', 'page_id', 'created_at'])
    .execute();
  await db.schema
    .createTable('reading_batches')
    .addColumn('id', 'uuid', (c) =>
      c.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (c) =>
      c.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('page_id', 'uuid', (c) =>
      c.references('pages.id').onDelete('set null'),
    )
    .addColumn('creator_id', 'uuid', (c) =>
      c.references('users.id').onDelete('set null'),
    )
    .addColumn('title', 'varchar(200)', (c) => c.notNull())
    .addColumn('status', 'varchar(16)', (c) => c.notNull().defaultTo('open'))
    .addColumn('created_at', 'timestamptz', (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn('closed_at', 'timestamptz')
    .addCheckConstraint(
      'reading_batch_status',
      sql`status in ('open', 'closed', 'revoked')`,
    )
    .addCheckConstraint(
      'reading_batch_closure',
      sql`(status = 'open') = (closed_at is null)`,
    )
    .addCheckConstraint('reading_batch_title', sql`length(trim(title)) > 0`)
    .execute();
  await db.schema
    .createIndex('reading_batches_creator')
    .on('reading_batches')
    .columns(['workspace_id', 'creator_id', 'created_at'])
    .execute();
  await db.schema
    .createTable('reading_snapshots')
    .addColumn('batch_id', 'uuid', (c) =>
      c.primaryKey().references('reading_batches.id').onDelete('cascade'),
    )
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('content', 'jsonb', (c) => c.notNull())
    .addColumn('text_content', 'text', (c) => c.notNull())
    .addColumn('content_hash', 'varchar(64)', (c) => c.notNull())
    .addColumn('source_updated_at', 'timestamptz', (c) => c.notNull())
    .execute();
  await db.schema
    .createTable('reading_recipients')
    .addColumn('id', 'uuid', (c) =>
      c.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('batch_id', 'uuid', (c) =>
      c.notNull().references('reading_batches.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (c) =>
      c.references('users.id').onDelete('set null'),
    )
    .addColumn('recipient_name', 'varchar', (c) => c.notNull())
    .addColumn('confirmed_at', 'timestamptz')
    .addUniqueConstraint('reading_recipients_batch_user', [
      'batch_id',
      'user_id',
    ])
    .execute();
  await db.schema
    .createIndex('reading_recipients_user')
    .on('reading_recipients')
    .columns(['user_id', 'batch_id'])
    .execute();
  await db.schema
    .createTable('collaboration_outbox')
    .addColumn('id', 'uuid', (c) =>
      c.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (c) =>
      c.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (c) =>
      c.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('actor_id', 'uuid', (c) =>
      c.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('page_id', 'uuid', (c) =>
      c.notNull().references('pages.id').onDelete('cascade'),
    )
    .addColumn('type', 'varchar(60)', (c) => c.notNull())
    .addColumn('resource_id', 'uuid', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn('delivered_at', 'timestamptz')
    .execute();
  await db.schema
    .createIndex('collaboration_outbox_pending')
    .on('collaboration_outbox')
    .column('created_at')
    .where(sql<boolean>`delivered_at is null`)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  for (const name of [
    'collaboration_outbox',
    'reading_recipients',
    'reading_snapshots',
    'reading_batches',
    'document_tasks',
  ]) {
    await db.schema.dropTable(name).execute();
  }
}
