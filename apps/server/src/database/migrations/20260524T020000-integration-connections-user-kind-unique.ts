import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // The original (integration_id, user_id) unique constraint predates the
  // `kind` discriminator. For workspace-scoped integrations (Slack), the
  // installer's user_id appears on BOTH the workspace bot row and their
  // personal user-link row. The constraint blocks that, and the resulting
  // upsert-conflict in user-link flow flipped the existing workspace row
  // to kind='user' (clobbering the bot connection).
  //
  // Replace with a partial unique index that only constrains kind='user'
  // rows. Workspace rows already have their own partial unique index on
  // (integration_id) WHERE kind = 'workspace'.

  await sql`ALTER TABLE integration_connections DROP CONSTRAINT uq_integration_connections_integration_user`.execute(
    db,
  );

  await db.schema
    .createIndex('uq_integration_connections_user_per_integration')
    .on('integration_connections')
    .columns(['integration_id', 'user_id'])
    .where(sql.ref('kind'), '=', 'user')
    .unique()
    .execute();

  // Repair Slack workspace rows that got flipped to kind='user' by the
  // earlier upsertUserLink bug. User-link rows have NULL access_token by
  // design; any kind='user' row that still has access_token AND scopes
  // populated for a Slack integration is the corrupted bot row.
  await sql`
    UPDATE integration_connections ic
    SET kind = 'workspace'
    FROM integrations i
    WHERE ic.integration_id = i.id
      AND i.type = 'slack'
      AND ic.kind = 'user'
      AND ic.access_token IS NOT NULL
      AND ic.scopes IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('uq_integration_connections_user_per_integration')
    .ifExists()
    .execute();

  // Re-adding the full constraint will fail on any DB that now legitimately
  // has both a kind='workspace' and kind='user' row for the same
  // (integration_id, user_id). Operators rolling back should clean those
  // up first. We don't try to be clever; the constraint name is preserved.
  await sql`ALTER TABLE integration_connections ADD CONSTRAINT uq_integration_connections_integration_user UNIQUE (integration_id, user_id)`.execute(
    db,
  );
}
