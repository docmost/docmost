"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('api_keys')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('name', 'text', (col) => col)
        .addColumn('creator_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
        .addColumn('workspace_id', 'uuid', (col) => col.notNull().references('workspaces.id').onDelete('cascade'))
        .addColumn('expires_at', 'timestamptz')
        .addColumn('last_used_at', 'timestamptz')
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('deleted_at', 'timestamptz', (col) => col)
        .execute();
}
async function down(db) {
    await db.schema.dropTable('api_keys').execute();
}
//# sourceMappingURL=20250912T101500-api-keys.js.map