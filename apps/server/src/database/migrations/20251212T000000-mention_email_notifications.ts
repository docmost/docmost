import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('mention_email_notifications')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('mention_id', 'varchar', (col) => col.notNull())
    .addColumn('source', 'varchar', (col) => col.notNull()) // 'page' | 'comment'
    .addColumn('mentioned_user_id', 'uuid', (col) =>
      col.references('users.id').notNull(),
    )
    .addColumn('actor_user_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('page_id', 'uuid', (col) => col.references('pages.id'))
    .addColumn('comment_id', 'uuid', (col) => col.references('comments.id'))
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('sent_at', 'timestamptz', (col) => col)
    .execute();

  await db.schema
    .createIndex('mention_email_notifications_workspace_mention_id_uq')
    .on('mention_email_notifications')
    .columns(['workspace_id', 'mention_id'])
    .unique()
    .execute();

  await db.schema
    .createIndex('mention_email_notifications_workspace_mentioned_user_idx')
    .on('mention_email_notifications')
    .columns(['workspace_id', 'mentioned_user_id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('mention_email_notifications').execute();
}


