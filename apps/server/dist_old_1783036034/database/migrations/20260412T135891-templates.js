"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('templates')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('title', 'varchar')
        .addColumn('description', 'text')
        .addColumn('content', 'jsonb')
        .addColumn('ydoc', 'bytea')
        .addColumn('icon', 'varchar')
        .addColumn('space_id', 'uuid', (col) => col.references('spaces.id').onDelete('cascade'))
        .addColumn('workspace_id', 'uuid', (col) => col.notNull().references('workspaces.id').onDelete('cascade'))
        .addColumn('creator_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
        .addColumn('last_updated_by_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
        .addColumn('collaborator_ids', (0, kysely_1.sql) `uuid[]`)
        .addColumn('text_content', 'text', (col) => col)
        .addColumn('tsv', (0, kysely_1.sql) `tsvector`, (col) => col)
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('deleted_at', 'timestamptz')
        .execute();
    await db.schema
        .createIndex('idx_templates_workspace_id')
        .on('templates')
        .columns(['workspace_id'])
        .execute();
    await db.schema
        .createIndex('idx_templates_space_id')
        .on('templates')
        .columns(['space_id'])
        .execute();
    await db.schema
        .createIndex('templates_tsv_idx')
        .on('templates')
        .using('GIN')
        .column('tsv')
        .execute();
    await (0, kysely_1.sql) `
    CREATE OR REPLACE FUNCTION templates_tsvector_trigger() RETURNS trigger AS $$
    begin
        new.tsv :=
                  setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
                  setweight(to_tsvector('english', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);
    await (0, kysely_1.sql) `CREATE OR REPLACE TRIGGER templates_tsvector_update BEFORE INSERT OR UPDATE
                ON templates FOR EACH ROW EXECUTE FUNCTION templates_tsvector_trigger();`.execute(db);
}
async function down(db) {
    await (0, kysely_1.sql) `DROP TRIGGER IF EXISTS templates_tsvector_update ON templates`.execute(db);
    await (0, kysely_1.sql) `DROP FUNCTION IF EXISTS templates_tsvector_trigger`.execute(db);
    await db.schema.dropTable('templates').execute();
}
//# sourceMappingURL=20260412T135891-templates.js.map