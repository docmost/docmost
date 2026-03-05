import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('ai_chats')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').notNull(),
    )
    .addColumn('title', 'varchar', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_ai_chats_workspace_creator')
    .on('ai_chats')
    .columns(['workspace_id', 'creator_id', 'id'])
    .execute();

  await db.schema
    .createTable('ai_chat_messages')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('chat_id', 'uuid', (col) =>
      col.references('ai_chats.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('role', 'varchar', (col) => col.notNull())
    .addColumn('content', 'text', (col) => col)
    .addColumn('tool_calls', 'jsonb', (col) => col)
    .addColumn('metadata', 'jsonb', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_ai_chat_messages_chat_id')
    .on('ai_chat_messages')
    .columns(['chat_id', 'id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('ai_chat_messages').execute();
  await db.schema.dropTable('ai_chats').execute();
}
