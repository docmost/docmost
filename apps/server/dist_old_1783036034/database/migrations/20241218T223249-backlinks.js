"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('backlinks')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('source_page_id', 'uuid', (col) => col.references('pages.id').onDelete('cascade').notNull())
        .addColumn('target_page_id', 'uuid', (col) => col.references('pages.id').onDelete('cascade').notNull())
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade').notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addUniqueConstraint('backlinks_source_page_id_target_page_id_unique', [
        'source_page_id',
        'target_page_id',
    ])
        .execute();
}
async function down(db) {
    await db.schema.dropTable('backlinks').execute();
}
//# sourceMappingURL=20241218T223249-backlinks.js.map