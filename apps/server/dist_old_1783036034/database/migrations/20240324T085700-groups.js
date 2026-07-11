"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('groups')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('name', 'varchar', (col) => col.notNull())
        .addColumn('description', 'text', (col) => col)
        .addColumn('is_default', 'boolean', (col) => col.notNull())
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade').notNull())
        .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('deleted_at', 'timestamptz', (col) => col)
        .addUniqueConstraint('groups_name_workspace_id_unique', [
        'name',
        'workspace_id',
    ])
        .execute();
    await db.schema
        .createTable('group_users')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('user_id', 'uuid', (col) => col.references('users.id').onDelete('cascade').notNull())
        .addColumn('group_id', 'uuid', (col) => col.references('groups.id').onDelete('cascade').notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addUniqueConstraint('group_users_group_id_user_id_unique', [
        'group_id',
        'user_id',
    ])
        .execute();
}
async function down(db) {
    await db.schema.dropTable('group_users').execute();
    await db.schema.dropTable('groups').execute();
}
//# sourceMappingURL=20240324T085700-groups.js.map