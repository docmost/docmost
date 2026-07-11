"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('user_mfa')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('user_id', 'uuid', (col) => col.references('users.id').onDelete('cascade').notNull())
        .addColumn('method', 'varchar', (col) => col.notNull().defaultTo('totp'))
        .addColumn('secret', 'text', (col) => col)
        .addColumn('is_enabled', 'boolean', (col) => col.defaultTo(false))
        .addColumn('backup_codes', (0, kysely_1.sql) `text[]`, (col) => col)
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade').notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addUniqueConstraint('user_mfa_user_id_unique', ['user_id'])
        .execute();
    await db.schema
        .alterTable('workspaces')
        .addColumn('enforce_mfa', 'boolean', (col) => col.defaultTo(false))
        .execute();
}
async function down(db) {
    await db.schema.alterTable('workspaces').dropColumn('enforce_mfa').execute();
    await db.schema.dropTable('user_mfa').execute();
}
//# sourceMappingURL=20250715T070817-mfa.js.map