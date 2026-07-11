"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('comments')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('content', 'jsonb', (col) => col)
        .addColumn('selection', 'varchar', (col) => col)
        .addColumn('type', 'varchar', (col) => col)
        .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
        .addColumn('page_id', 'uuid', (col) => col.references('pages.id').onDelete('cascade').notNull())
        .addColumn('parent_comment_id', 'uuid', (col) => col.references('comments.id').onDelete('cascade'))
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').notNull())
        .addColumn('resolved_at', 'timestamptz', (col) => col)
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('edited_at', 'timestamptz', (col) => col)
        .addColumn('deleted_at', 'timestamptz', (col) => col)
        .execute();
}
async function down(db) {
    await db.schema.dropTable('comments').execute();
}
//# sourceMappingURL=20240324T086600-comments.js.map