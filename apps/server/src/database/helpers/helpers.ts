import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

export async function isPageEmbeddingsTableExists(db: KyselyDB) {
  return tableExists({ db, tableName: 'page_embeddings' });
}

export async function tableExists(opts: {
  db: KyselyDB;
  tableName: string;
}): Promise<boolean> {
  const { db, tableName } = opts;
  const result = await sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = COALESCE(current_schema(), 'public')
        AND table_name = ${tableName}
      ) as exists
    `.execute(db);

  return result.rows[0]?.exists ?? false;
}
