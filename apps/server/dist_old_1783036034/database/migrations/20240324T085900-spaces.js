"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
const permission_1 = require("../../common/helpers/types/permission");
async function up(db) {
    await db.schema
        .createTable('spaces')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('name', 'varchar', (col) => col)
        .addColumn('description', 'text', (col) => col)
        .addColumn('slug', 'varchar', (col) => col.notNull())
        .addColumn('logo', 'varchar', (col) => col)
        .addColumn('visibility', 'varchar', (col) => col.defaultTo(permission_1.SpaceVisibility.PRIVATE).notNull())
        .addColumn('default_role', 'varchar', (col) => col.defaultTo(permission_1.SpaceRole.WRITER).notNull())
        .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade').notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('deleted_at', 'timestamptz', (col) => col)
        .addUniqueConstraint('spaces_slug_workspace_id_unique', [
        'slug',
        'workspace_id',
    ])
        .execute();
    await db.schema
        .createTable('space_members')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('user_id', 'uuid', (col) => col.references('users.id').onDelete('cascade'))
        .addColumn('group_id', 'uuid', (col) => col.references('groups.id').onDelete('cascade'))
        .addColumn('space_id', 'uuid', (col) => col.references('spaces.id').onDelete('cascade').notNull())
        .addColumn('role', 'varchar', (col) => col.notNull())
        .addColumn('added_by_id', 'uuid', (col) => col.references('users.id'))
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('deleted_at', 'timestamptz', (col) => col)
        .addUniqueConstraint('space_members_space_id_user_id_unique', [
        'space_id',
        'user_id',
    ])
        .addUniqueConstraint('space_members_space_id_group_id_unique', [
        'space_id',
        'group_id',
    ])
        .addCheckConstraint('allow_either_user_id_or_group_id_check', (0, kysely_1.sql) `(("user_id" IS NOT NULL AND "group_id" IS NULL) OR ("user_id" IS NULL AND "group_id" IS NOT NULL))`)
        .execute();
}
async function down(db) {
    await db.schema.dropTable('space_members').execute();
    await db.schema.dropTable('spaces').execute();
}
//# sourceMappingURL=20240324T085900-spaces.js.map