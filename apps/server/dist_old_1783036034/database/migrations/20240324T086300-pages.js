"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('pages')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('slug_id', 'varchar', (col) => col.notNull())
        .addColumn('title', 'varchar', (col) => col)
        .addColumn('icon', 'varchar', (col) => col)
        .addColumn('cover_photo', 'varchar', (col) => col)
        .addColumn('position', 'varchar', (col) => col)
        .addColumn('content', 'jsonb', (col) => col)
        .addColumn('ydoc', 'bytea', (col) => col)
        .addColumn('text_content', 'text', (col) => col)
        .addColumn('tsv', (0, kysely_1.sql) `tsvector`, (col) => col)
        .addColumn('parent_page_id', 'uuid', (col) => col.references('pages.id').onDelete('cascade'))
        .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
        .addColumn('last_updated_by_id', 'uuid', (col) => col.references('users.id'))
        .addColumn('deleted_by_id', 'uuid', (col) => col.references('users.id'))
        .addColumn('space_id', 'uuid', (col) => col.references('spaces.id').onDelete('cascade').notNull())
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade').notNull())
        .addColumn('is_locked', 'boolean', (col) => col.defaultTo(false).notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('deleted_at', 'timestamptz', (col) => col)
        .addUniqueConstraint('pages_slug_id_unique', ['slug_id'])
        .execute();
    await db.schema
        .createIndex('pages_tsv_idx')
        .on('pages')
        .using('GIN')
        .column('tsv')
        .execute();
    await db.schema
        .createIndex('pages_slug_id_idx')
        .on('pages')
        .column('slug_id')
        .execute();
}
async function down(db) {
    await db.schema.dropTable('pages').execute();
}
//# sourceMappingURL=20240324T086300-pages.js.map