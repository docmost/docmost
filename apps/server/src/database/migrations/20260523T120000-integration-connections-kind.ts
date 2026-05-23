import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Drop NOT NULL on access_token (identity-only rows have no token)
  await db.schema
    .alterTable('integration_connections')
    .alterColumn('access_token', (col) => col.dropNotNull())
    .execute();

  // 2. Add kind discriminator with check constraint
  await db.schema
    .alterTable('integration_connections')
    .addColumn('kind', 'text', (col) =>
      col.notNull().defaultTo('user'),
    )
    .execute();

  await sql`
    ALTER TABLE integration_connections
    ADD CONSTRAINT integration_connections_kind_check
    CHECK (kind IN ('workspace', 'user'))
  `.execute(db);

  // 3. Backfill: existing Slack workspace installs (rows with access_token)
  await sql`
    UPDATE integration_connections AS ic
    SET kind = 'workspace'
    FROM integrations AS i
    WHERE ic.integration_id = i.id
      AND i.type = 'slack'
      AND ic.access_token IS NOT NULL
  `.execute(db);

  // 4. One workspace connection per integration
  await db.schema
    .createIndex('uq_integration_connections_workspace_per_integration')
    .on('integration_connections')
    .column('integration_id')
    .where(sql.ref('kind'), '=', 'workspace')
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('uq_integration_connections_workspace_per_integration')
    .ifExists()
    .execute();

  await sql`ALTER TABLE integration_connections DROP CONSTRAINT IF EXISTS integration_connections_kind_check`.execute(db);

  await db.schema
    .alterTable('integration_connections')
    .dropColumn('kind')
    .execute();

  // Note: we don't restore NOT NULL on access_token in down(); by this point
  // there may be legitimate null-token rows (identity-only user links) that
  // would block re-adding the constraint.
}
