import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .addColumn('diagram_type', 'text', (col) =>
      col.check(sql`diagram_type IN ('drawio', 'excalidraw')`),
    )
    .execute();

  // Backfill diagrams from their owning document.
  for (const [table, owner] of [
    ['pages', 'page_id'],
    ['templates', 'template_id'],
  ] as const) {
    await sql`
      WITH svg_files AS (
        SELECT id, ${sql.ref(owner)} AS owner_id, workspace_id
        FROM attachments
        WHERE type = 'file' AND lower(file_ext) = '.svg'
          AND deleted_at IS NULL AND ai_chat_id IS NULL
          AND ${sql.ref(owner)} IS NOT NULL
      ), owners AS (
        SELECT DISTINCT owner_id, workspace_id FROM svg_files
      ), diagrams AS MATERIALIZED (
        SELECT owners.*, diagram.attachment_id, diagram.format
        FROM owners
        JOIN ${sql.table(table)} AS document
          ON document.id = owners.owner_id AND document.workspace_id = owners.workspace_id
        CROSS JOIN LATERAL (
          WITH RECURSIVE blocks(node) AS (
            SELECT document.content
            UNION ALL
            SELECT child FROM blocks
            CROSS JOIN LATERAL jsonb_array_elements(
              CASE WHEN jsonb_typeof(node->'content') = 'array' THEN node->'content' ELSE '[]'::jsonb END
            ) AS child
          )
          SELECT node #>> '{attrs,attachmentId}' AS attachment_id, min(node->>'type') AS format
          FROM blocks
          WHERE node #>> '{attrs,attachmentId}' IS NOT NULL
          GROUP BY node #>> '{attrs,attachmentId}'
          HAVING count(DISTINCT coalesce(node->>'type', '')) = 1
            AND min(node->>'type') IN ('drawio', 'excalidraw')
        ) AS diagram
      )
      UPDATE attachments AS attachment
      SET diagram_type = diagrams.format
      FROM svg_files AS file
      JOIN diagrams ON file.id::text = diagrams.attachment_id
        AND file.owner_id = diagrams.owner_id AND file.workspace_id = diagrams.workspace_id
      WHERE attachment.id = file.id
    `.execute(db);
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .dropColumn('diagram_type')
    .execute();
}
