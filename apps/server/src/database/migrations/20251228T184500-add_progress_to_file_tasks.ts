import { Kysely } from 'kysely';

/**
 * Add a `progress` column to the `file_tasks` table.
 *
 * Adds an `int4` column named `progress` with a default value of `0` to the `file_tasks` table.
 */
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable('file_tasks')
        .addColumn('progress', 'int4', (col) => col.defaultTo(0))
        .execute();
}

/**
 * Reverts the migration by removing the `progress` column from the `file_tasks` table.
 */
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable('file_tasks').dropColumn('progress').execute();
}