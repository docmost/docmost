"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('page_access')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('page_id', 'uuid', (col) => col.notNull().unique().references('pages.id').onDelete('cascade'))
        .addColumn('workspace_id', 'uuid', (col) => col.notNull().references('workspaces.id').onDelete('cascade'))
        .addColumn('space_id', 'uuid', (col) => col.notNull().references('spaces.id').onDelete('cascade'))
        .addColumn('access_level', 'varchar', (col) => col.notNull())
        .addColumn('creator_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .execute();
    await db.schema
        .createTable('page_permissions')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('page_access_id', 'uuid', (col) => col.notNull().references('page_access.id').onDelete('cascade'))
        .addColumn('user_id', 'uuid', (col) => col.references('users.id').onDelete('cascade'))
        .addColumn('group_id', 'uuid', (col) => col.references('groups.id').onDelete('cascade'))
        .addColumn('role', 'varchar', (col) => col.notNull())
        .addColumn('added_by_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addUniqueConstraint('page_access_user_unique', [
        'page_access_id',
        'user_id',
    ])
        .addUniqueConstraint('page_access_group_unique', [
        'page_access_id',
        'group_id',
    ])
        .addCheckConstraint('allow_either_user_id_or_group_id_check', (0, kysely_1.sql) `((user_id IS NOT NULL AND group_id IS NULL) OR (user_id IS NULL AND group_id IS NOT NULL))`)
        .execute();
    await db.schema
        .createIndex('idx_page_access_space')
        .on('page_access')
        .column('space_id')
        .execute();
    await db.schema
        .createIndex('idx_page_permissions_user')
        .on('page_permissions')
        .column('user_id')
        .execute();
    await db.schema
        .createIndex('idx_page_permissions_group')
        .on('page_permissions')
        .column('group_id')
        .execute();
}
async function down(db) {
    await db.schema.dropTable('page_permissions').ifExists().execute();
    await db.schema.dropTable('page_access').ifExists().execute();
}
//# sourceMappingURL=20260224T233803-page-permissions.js.map