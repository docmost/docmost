"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('shares')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('key', 'varchar', (col) => col.notNull())
        .addColumn('page_id', 'uuid', (col) => col.references('pages.id').onDelete('cascade'))
        .addColumn('include_sub_pages', 'boolean', (col) => col.defaultTo(false))
        .addColumn('search_indexing', 'boolean', (col) => col.defaultTo(false))
        .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
        .addColumn('space_id', 'uuid', (col) => col.references('spaces.id').onDelete('cascade').notNull())
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade').notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('deleted_at', 'timestamptz', (col) => col)
        .addUniqueConstraint('shares_key_workspace_id_unique', [
        'key',
        'workspace_id',
    ])
        .execute();
}
async function down(db) {
    await db.schema.dropTable('shares').execute();
}
//# sourceMappingURL=20250408T191830-shares.js.map