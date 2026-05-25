import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('docops_audit_logs')
    .ifNotExists()
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('actor_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('action', 'varchar', (col) => col.notNull())
    .addColumn('entity_kind', 'varchar', (col) => col.notNull())
    .addColumn('entity_id', 'uuid', (col) => col.notNull())
    .addColumn('ip', sql`inet`, (col) => col)
    .addColumn('user_agent', 'text', (col) => col)
    .addColumn('payload_diff', 'jsonb', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_docops_audit_entity')
    .ifNotExists()
    .on('docops_audit_logs')
    .columns(['entity_kind', 'entity_id', 'created_at'])
    .execute();

  await db.schema
    .createIndex('idx_docops_audit_actor')
    .ifNotExists()
    .on('docops_audit_logs')
    .columns(['actor_id', 'created_at'])
    .execute();

  await db.schema
    .createIndex('idx_docops_audit_action')
    .ifNotExists()
    .on('docops_audit_logs')
    .columns(['action', 'created_at'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('docops_audit_logs').execute();
}
