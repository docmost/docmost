import { type Kysely, sql } from 'kysely';

// pgvector-backed storage for AI Answers (RAG). The embedding dimension is fixed
// at table-creation time from AI_EMBEDDING_DIMENSION (default 1536); changing the
// dimension later requires re-embedding. Requires the pgvector extension.
export async function up(db: Kysely<any>): Promise<void> {
  const dim = parseInt(process.env.AI_EMBEDDING_DIMENSION || '1536', 10);

  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await db.schema
    .createTable('page_embeddings')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('attachment_id', 'uuid', (col) => col)
    .addColumn('model_name', 'varchar', (col) => col.notNull())
    .addColumn('model_dimensions', 'integer', (col) => col.notNull())
    .addColumn('embedding', sql`vector(${sql.raw(String(dim))})`, (col) =>
      col.notNull(),
    )
    .addColumn('chunk_index', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('chunk_start', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('chunk_length', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('metadata', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .execute();

  await db.schema
    .createIndex('page_embeddings_page_id_idx')
    .on('page_embeddings')
    .column('page_id')
    .execute();

  await db.schema
    .createIndex('page_embeddings_workspace_id_idx')
    .on('page_embeddings')
    .column('workspace_id')
    .execute();

  // HNSW index for cosine-distance ANN search
  await sql`
    CREATE INDEX page_embeddings_embedding_hnsw_idx
    ON page_embeddings USING hnsw (embedding vector_cosine_ops)
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('page_embeddings').ifExists().execute();
}
