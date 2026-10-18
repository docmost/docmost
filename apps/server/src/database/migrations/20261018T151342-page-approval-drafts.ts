import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_drafts')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.notNull().unique().references('pages.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('title', 'varchar')
    .addColumn('icon', 'varchar')
    .addColumn('content', 'jsonb')
    .addColumn('ydoc', 'bytea')
    .addColumn('last_updated_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('contributor_ids', sql`uuid[]`, (col) =>
      col.notNull().defaultTo('{}'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .alterTable('page_history')
    .addColumn('kind', 'varchar')
    .addColumn('change_summary', 'text')
    .addColumn('approved_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('approved_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('idx_page_history_reader_versions')
    .on('page_history')
    .columns(['page_id', 'created_at desc'])
    .where(sql.ref('kind'), 'in', ['approved', 'baseline'])
    .execute();

  await db.schema
    .createIndex('uq_page_history_approved_version')
    .unique()
    .on('page_history')
    .columns(['page_id', 'version'])
    .where(sql.ref('kind'), '=', 'approved')
    .execute();

  await db.schema
    .alterTable('page_verifications')
    .addColumn('pending_history_id', 'uuid', (col) =>
      col.references('page_history.id').onDelete('set null'),
    )
    .addColumn('source', 'varchar', (col) => col.notNull().defaultTo('page'))
    .execute();

  await db.schema
    .alterTable('attachments')
    .addColumn('is_draft', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();

  // Approved pages keep their current content as version 1.
  await sql`
    INSERT INTO page_history (
      page_id, slug_id, title, content, icon, cover_photo, last_updated_by_id,
      contributor_ids, space_id, workspace_id, kind, version, approved_by_id,
      approved_at, change_summary
    )
    SELECT
      p.id, p.slug_id, p.title, p.content, p.icon, p.cover_photo,
      COALESCE(p.last_updated_by_id, p.creator_id), p.contributor_ids,
      p.space_id, p.workspace_id, 'approved', 1, pv.verified_by_id,
      COALESCE(pv.verified_at, now()),
      'Approved before version history was available'
    FROM page_verifications pv
    JOIN pages p ON p.id = pv.page_id
    WHERE pv.type = 'qms' AND pv.status = 'approved' AND p.is_base = false
  `.execute(db);

  // Every other status gets its current content as an unapproved baseline.
  await sql`
    INSERT INTO page_history (
      page_id, slug_id, title, content, icon, cover_photo, last_updated_by_id,
      contributor_ids, space_id, workspace_id, kind
    )
    SELECT
      p.id, p.slug_id, p.title, p.content, p.icon, p.cover_photo,
      COALESCE(p.last_updated_by_id, p.creator_id), p.contributor_ids,
      p.space_id, p.workspace_id, 'baseline'
    FROM page_verifications pv
    JOIN pages p ON p.id = pv.page_id
    WHERE pv.type = 'qms'
      AND pv.status IS DISTINCT FROM 'approved'
      AND p.is_base = false
  `.execute(db);

  // Pages in review get the frozen submission the approver will publish.
  await sql`
    WITH submitted AS (
      INSERT INTO page_history (
        page_id, slug_id, title, content, icon, cover_photo,
        last_updated_by_id, contributor_ids, space_id, workspace_id, kind
      )
      SELECT
        p.id, p.slug_id, p.title, p.content, p.icon, p.cover_photo,
        COALESCE(p.last_updated_by_id, p.creator_id), p.contributor_ids,
        p.space_id, p.workspace_id, 'draft'
      FROM page_verifications v
      JOIN pages p ON p.id = v.page_id
      WHERE v.type = 'qms' AND v.status = 'in_approval' AND p.is_base = false
      RETURNING id, page_id
    )
    UPDATE page_verifications pv
    SET pending_history_id = submitted.id
    FROM submitted
    WHERE pv.page_id = submitted.page_id
  `.execute(db);

  // Yjs state moves to the draft; pages.ydoc stays null while a draft exists.
  await sql`
    INSERT INTO page_drafts (
      page_id, workspace_id, content, ydoc, last_updated_by_id, contributor_ids
    )
    SELECT
      p.id, p.workspace_id, p.content, p.ydoc, p.last_updated_by_id,
      COALESCE(p.contributor_ids, '{}')
    FROM page_verifications pv
    JOIN pages p ON p.id = pv.page_id
    WHERE pv.type = 'qms' AND p.is_base = false
  `.execute(db);

  await sql`
    UPDATE pages SET ydoc = NULL
    WHERE id IN (SELECT page_id FROM page_drafts)
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Draft title/icon are not copied back; text_content is not recomputed.
  await sql`
    UPDATE pages p
    SET ydoc = d.ydoc, content = COALESCE(d.content, p.content)
    FROM page_drafts d
    WHERE d.page_id = p.id
  `.execute(db);

  await sql`DELETE FROM page_history WHERE kind IS NOT NULL`.execute(db);

  await db.schema
    .dropIndex('uq_page_history_approved_version')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_page_history_reader_versions')
    .ifExists()
    .execute();

  await db.schema.alterTable('attachments').dropColumn('is_draft').execute();

  await db.schema
    .alterTable('page_verifications')
    .dropColumn('pending_history_id')
    .dropColumn('source')
    .execute();

  await db.schema
    .alterTable('page_history')
    .dropColumn('approved_at')
    .dropColumn('approved_by_id')
    .dropColumn('change_summary')
    .dropColumn('kind')
    .execute();

  await db.schema.dropTable('page_drafts').execute();
}
