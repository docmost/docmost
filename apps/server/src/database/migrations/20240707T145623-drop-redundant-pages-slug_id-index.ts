import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('pages_slug_id_idx').ifExists().execute();
}

export async function down(db: Kysely<any>): Promise<void> {}
