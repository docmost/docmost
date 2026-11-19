import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable('task_notification_batches')
    .addColumn('id', 'uuid', (c) =>
      c.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('user_id', 'uuid', (c) =>
      c.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('deliver_at', 'timestamptz', (c) =>
      c.notNull().defaultTo(sql`now() + interval '5 minutes'`),
    )
    .addColumn('sealed_at', 'timestamptz')
    .addColumn('queued', 'boolean', (c) => c.notNull().defaultTo(false))
    .execute();
  await sql`create unique index task_notification_open_recipient on task_notification_batches(user_id) where sealed_at is null`.execute(
    db,
  );
  await sql`create index task_notification_due on task_notification_batches(deliver_at) where not queued`.execute(
    db,
  );
  await sql`create index task_notification_recent on task_notification_batches(user_id, sealed_at desc) where sealed_at is not null`.execute(
    db,
  );
  await db.schema
    .createTable('task_notification_items')
    .addColumn('batch_id', 'uuid', (c) =>
      c
        .notNull()
        .references('task_notification_batches.id')
        .onDelete('cascade'),
    )
    .addColumn('task_id', 'uuid', (c) =>
      c.notNull().references('page_tasks.id').onDelete('cascade'),
    )
    .addColumn('assignment_id', 'uuid')
    .addColumn('checked_before', 'boolean')
    .addColumn('checked_after', 'boolean')
    .addPrimaryKeyConstraint('task_notification_items_pk', [
      'batch_id',
      'task_id',
    ])
    .execute();
  await db.schema
    .createIndex('task_notification_items_task_idx')
    .on('task_notification_items')
    .column('task_id')
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable('task_notification_items').execute();
  await db.schema.dropTable('task_notification_batches').execute();
}
