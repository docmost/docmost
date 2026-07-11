"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('notifications')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('user_id', 'uuid', (col) => col.references('users.id').onDelete('cascade').notNull())
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade').notNull())
        .addColumn('type', 'text', (col) => col.notNull())
        .addColumn('actor_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
        .addColumn('page_id', 'uuid', (col) => col.references('pages.id').onDelete('cascade'))
        .addColumn('space_id', 'uuid', (col) => col.references('spaces.id').onDelete('cascade'))
        .addColumn('comment_id', 'uuid', (col) => col.references('comments.id').onDelete('cascade'))
        .addColumn('data', 'jsonb')
        .addColumn('read_at', 'timestamptz')
        .addColumn('emailed_at', 'timestamptz')
        .addColumn('archived_at', 'timestamptz')
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .execute();
    await db.schema
        .createIndex('idx_notifications_user_id')
        .on('notifications')
        .columns(['user_id', 'id desc'])
        .execute();
    await db.schema
        .createIndex('idx_notifications_user_unread')
        .on('notifications')
        .column('user_id')
        .where(kysely_1.sql.ref('read_at'), 'is', null)
        .execute();
}
async function down(db) {
    await db.schema.dropTable('notifications').execute();
}
//# sourceMappingURL=20260213T085259-notifications.js.map