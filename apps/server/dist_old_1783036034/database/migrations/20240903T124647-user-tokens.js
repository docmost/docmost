"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('user_tokens')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('token', 'varchar', (col) => col.notNull())
        .addColumn('type', 'varchar', (col) => col.notNull())
        .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade'))
        .addColumn('expires_at', 'timestamptz')
        .addColumn('used_at', 'timestamptz', (col) => col)
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .execute();
}
async function down(db) {
    await db.schema.dropTable('user_tokens').execute();
}
//# sourceMappingURL=20240903T124647-user-tokens.js.map