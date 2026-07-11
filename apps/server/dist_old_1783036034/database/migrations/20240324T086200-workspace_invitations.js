"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('workspace_invitations')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('email', 'varchar', (col) => col)
        .addColumn('role', 'varchar', (col) => col.notNull())
        .addColumn('token', 'varchar', (col) => col.notNull())
        .addColumn('group_ids', (0, kysely_1.sql) `uuid[]`, (col) => col)
        .addColumn('invited_by_id', 'uuid', (col) => col.references('users.id'))
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade').notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addUniqueConstraint('invitations_email_workspace_id_unique', [
        'email',
        'workspace_id',
    ])
        .execute();
}
async function down(db) {
    await db.schema.dropTable('workspace_invitations').execute();
}
//# sourceMappingURL=20240324T086200-workspace_invitations.js.map