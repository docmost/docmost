"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('watchers')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('user_id', 'uuid', (col) => col.references('users.id').onDelete('cascade').notNull())
        .addColumn('page_id', 'uuid', (col) => col.references('pages.id').onDelete('cascade'))
        .addColumn('space_id', 'uuid', (col) => col.references('spaces.id').onDelete('cascade').notNull())
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade').notNull())
        .addColumn('type', 'text', (col) => col.notNull())
        .addColumn('added_by_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
        .addColumn('muted_at', 'timestamptz')
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .execute();
    await db.schema
        .createIndex('idx_watchers_user_page')
        .on('watchers')
        .columns(['user_id', 'page_id'])
        .unique()
        .where('page_id', 'is not', null)
        .execute();
    await db.schema
        .createIndex('idx_watchers_user_space')
        .on('watchers')
        .columns(['user_id', 'space_id'])
        .unique()
        .where(kysely_1.sql.ref('page_id'), 'is', null)
        .execute();
    await db.schema
        .createIndex('idx_watchers_page_id')
        .on('watchers')
        .column('page_id')
        .execute();
}
async function down(db) {
    await db.schema.dropTable('watchers').execute();
}
//# sourceMappingURL=20260213T085320-watchers.js.map