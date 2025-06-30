import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('totp_enabled', 'boolean', (col) => col.defaultTo(false).notNull())
    .addColumn('totp_secret', 'varchar', (col) => col)
    .addColumn('totp_backup_codes', 'jsonb', (col) => col)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .dropColumn('totp_enabled')
    .dropColumn('totp_secret')
    .dropColumn('totp_backup_codes')
    .execute();
}
