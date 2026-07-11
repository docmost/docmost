"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('page_history')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('page_id', 'uuid', (col) => col.references('pages.id').onDelete('cascade').notNull())
        .addColumn('slug_id', 'varchar', (col) => col)
        .addColumn('title', 'varchar', (col) => col)
        .addColumn('content', 'jsonb', (col) => col)
        .addColumn('slug', 'varchar', (col) => col)
        .addColumn('icon', 'varchar', (col) => col)
        .addColumn('cover_photo', 'varchar', (col) => col)
        .addColumn('version', 'int4', (col) => col)
        .addColumn('last_updated_by_id', 'uuid', (col) => col.references('users.id'))
        .addColumn('space_id', 'uuid', (col) => col.references('spaces.id').onDelete('cascade').notNull())
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade').notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .execute();
}
async function down(db) {
    await db.schema.dropTable('page_history').execute();
}
//# sourceMappingURL=20240324T086400-page_history.js.map