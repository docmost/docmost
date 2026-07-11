"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('users')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('name', 'varchar', (col) => col)
        .addColumn('email', 'varchar', (col) => col.notNull())
        .addColumn('email_verified_at', 'timestamptz', (col) => col)
        .addColumn('password', 'varchar', (col) => col)
        .addColumn('avatar_url', 'varchar', (col) => col)
        .addColumn('role', 'varchar', (col) => col)
        .addColumn('invited_by_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade'))
        .addColumn('locale', 'varchar', (col) => col)
        .addColumn('timezone', 'varchar', (col) => col)
        .addColumn('settings', 'jsonb', (col) => col)
        .addColumn('last_active_at', 'timestamptz', (col) => col)
        .addColumn('last_login_at', 'timestamptz', (col) => col)
        .addColumn('deactivated_at', 'timestamptz', (col) => col)
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('deleted_at', 'timestamptz', (col) => col)
        .addUniqueConstraint('users_email_workspace_id_unique', [
        'email',
        'workspace_id',
    ])
        .execute();
}
async function down(db) {
    await db.schema.dropTable('users').execute();
}
//# sourceMappingURL=20240324T085600-users.js.map