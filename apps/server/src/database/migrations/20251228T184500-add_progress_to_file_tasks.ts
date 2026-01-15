import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable('file_tasks')
        .addColumn('progress', 'int4', (col) => col.defaultTo(0))
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable('file_tasks').dropColumn('progress').execute();
}
