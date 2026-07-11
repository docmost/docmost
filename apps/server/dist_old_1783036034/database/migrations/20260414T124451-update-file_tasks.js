"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .alterTable('file_tasks')
        .addColumn('page_id', 'uuid', (col) => col.references('pages.id').onDelete('set null').ifNotExists())
        .execute();
    await db.schema
        .alterTable('file_tasks')
        .addColumn('metadata', 'jsonb', (col) => col.ifNotExists())
        .execute();
    await db.schema
        .createIndex('idx_file_tasks_page_export')
        .ifNotExists()
        .on('file_tasks')
        .columns(['page_id', 'workspace_id'])
        .where(kysely_1.sql.ref('type'), '=', 'export')
        .where(kysely_1.sql.ref('deleted_at'), 'is', null)
        .execute();
}
async function down(db) {
    await db.schema.dropIndex('idx_file_tasks_page_export').execute();
    await db.schema.alterTable('file_tasks').dropColumn('page_id').execute();
    await db.schema.alterTable('file_tasks').dropColumn('metadata').execute();
}
//# sourceMappingURL=20260414T124451-update-file_tasks.js.map