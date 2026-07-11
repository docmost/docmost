"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
const permission_1 = require("../../common/helpers/types/permission");
async function up(db) {
    await db.schema
        .createTable('workspaces')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('name', 'varchar', (col) => col)
        .addColumn('description', 'varchar', (col) => col)
        .addColumn('logo', 'varchar', (col) => col)
        .addColumn('hostname', 'varchar', (col) => col)
        .addColumn('custom_domain', 'varchar', (col) => col)
        .addColumn('settings', 'jsonb', (col) => col)
        .addColumn('default_role', 'varchar', (col) => col.defaultTo(permission_1.UserRole.MEMBER).notNull())
        .addColumn('email_domains', (0, kysely_1.sql) `varchar[]`, (col) => col.defaultTo('{}'))
        .addColumn('default_space_id', 'uuid', (col) => col)
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('deleted_at', 'timestamptz', (col) => col)
        .addUniqueConstraint('workspaces_hostname_unique', ['hostname'])
        .addUniqueConstraint('workspaces_custom_domain_unique', ['custom_domain'])
        .execute();
}
async function down(db) {
    await db.schema.dropTable('workspaces').execute();
}
//# sourceMappingURL=20240324T085500-workspaces.js.map