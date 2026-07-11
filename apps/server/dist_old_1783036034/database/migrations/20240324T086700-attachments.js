"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('attachments')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('file_name', 'varchar', (col) => col.notNull())
        .addColumn('file_path', 'varchar', (col) => col.notNull())
        .addColumn('file_size', 'int8', (col) => col)
        .addColumn('file_ext', 'varchar', (col) => col.notNull())
        .addColumn('mime_type', 'varchar', (col) => col)
        .addColumn('type', 'varchar', (col) => col)
        .addColumn('creator_id', 'uuid', (col) => col.references('users.id').notNull())
        .addColumn('page_id', 'uuid', (col) => col)
        .addColumn('space_id', 'uuid', (col) => col)
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade').notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('deleted_at', 'timestamptz', (col) => col)
        .execute();
}
async function down(db) {
    await db.schema.dropTable('attachments').execute();
}
//# sourceMappingURL=20240324T086700-attachments.js.map