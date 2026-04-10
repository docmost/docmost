import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('ai_chats')
    .ifNotExists()
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
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .execute();

  await db.schema
    .createIndex('idx_ai_chats_workspace_creator')
    .ifNotExists()
    .on('ai_chats')
    .columns(['workspace_id', 'creator_id', 'id'])
    .execute();

  await db.schema
    .createTable('ai_chat_messages')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('chat_id', 'uuid', (col) =>
      col.references('ai_chats.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('role', 'varchar', (col) => col.notNull())
    .addColumn('content', 'text', (col) => col)
    .addColumn('tool_calls', 'jsonb', (col) => col)
    .addColumn('metadata', 'jsonb', (col) => col)
    .addColumn('tsv', sql`tsvector`, (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .execute();

  await db.schema
    .createIndex('idx_ai_chat_messages_chat_id')
    .ifNotExists()
    .on('ai_chat_messages')
    .columns(['chat_id', 'id'])
    .execute();

  await db.schema
    .createIndex('idx_ai_chat_messages_tsv')
    .ifNotExists()
    .on('ai_chat_messages')
    .using('GIN')
    .column('tsv')
    .execute();

  //ts-vector
  await sql`
    CREATE OR REPLACE FUNCTION ai_chat_messages_tsvector_trigger() RETURNS trigger AS $$
    BEGIN
      NEW.tsv := to_tsvector('english', f_unaccent(substring(coalesce(NEW.content, ''), 1, 100000)));
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`
    CREATE OR REPLACE TRIGGER ai_chat_messages_tsvector_update
      BEFORE INSERT OR UPDATE ON ai_chat_messages
      FOR EACH ROW EXECUTE FUNCTION ai_chat_messages_tsvector_trigger();
  `.execute(db);

  await db.schema
    .alterTable('attachments')
    .addColumn('ai_chat_id', 'uuid', (col) => col)
    .execute();

  await db.schema
    .createIndex('idx_attachments_ai_chat_id')
    .ifNotExists()
    .on('attachments')
    .column('ai_chat_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_attachments_ai_chat_id').execute();
  await db.schema.alterTable('attachments').dropColumn('ai_chat_id').execute();

  await sql`DROP TRIGGER IF EXISTS ai_chat_messages_tsvector_update ON ai_chat_messages`.execute(
    db,
  );
  await sql`DROP FUNCTION IF EXISTS ai_chat_messages_tsvector_trigger`.execute(
    db,
  );
  await db.schema.dropTable('ai_chat_messages').execute();
  await db.schema.dropTable('ai_chats').execute();
}
