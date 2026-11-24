import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .addColumn('diagram_type', 'text', (col) =>
      col.check(sql`diagram_type IN ('drawio', 'excalidraw')`),
    )
    .addColumn('diagram_id', 'uuid')
    .execute();

  await db.schema
    .createIndex('attachments_diagram_id_idx')
    .on('attachments')
    .column('diagram_id')
    .where('diagram_id', 'is not', null)
    .execute();

  await db.schema
    .createTable('diagram_drafts')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('draft_key', 'text', (col) => col.notNull())
    .addColumn('active', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
  await db.schema
    .createIndex('diagram_drafts_active_key_idx')
    .unique()
    .on('diagram_drafts')
    .column('draft_key')
    .where(sql.ref('active'), '=', true)
    .execute();
  await db.schema
    .createIndex('diagram_drafts_updated_at_idx')
    .on('diagram_drafts')
    .column('updated_at')
    .execute();

  // Backfill existing diagrams.
  await db
    .updateTable('attachments')
    .set({ diagram_type: sql`split_part(file_name, '.', 2)` })
    .where('type', '=', 'file')
    .where('file_name', 'in', ['diagram.drawio.svg', 'diagram.excalidraw.svg'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('diagram_drafts').execute();
  await db.schema
    .alterTable('attachments')
    .dropColumn('diagram_id')
    .dropColumn('diagram_type')
    .execute();
}
