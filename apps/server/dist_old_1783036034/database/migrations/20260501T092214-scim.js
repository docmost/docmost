"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('scim_tokens')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('name', 'varchar', (col) => col.notNull())
        .addColumn('token_hash', 'varchar', (col) => col.notNull())
        .addColumn('token_last_four', 'varchar(4)', (col) => col.notNull())
        .addColumn('last_used_at', 'timestamptz')
        .addColumn('is_enabled', 'boolean', (col) => col.notNull().defaultTo(true))
        .addColumn('creator_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade').notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('deleted_at', 'timestamptz')
        .execute();
    await db.schema
        .createIndex('idx_scim_tokens_token_hash')
        .ifNotExists()
        .on('scim_tokens')
        .column('token_hash')
        .execute();
    await db.schema
        .createIndex('idx_scim_tokens_workspace_id')
        .ifNotExists()
        .on('scim_tokens')
        .column('workspace_id')
        .execute();
    await db.schema
        .alterTable('users')
        .addColumn('scim_external_id', 'text')
        .execute();
    await db.schema
        .createIndex('idx_users_workspace_scim_external_id')
        .ifNotExists()
        .on('users')
        .columns(['workspace_id', 'scim_external_id'])
        .where('scim_external_id', 'is not', null)
        .unique()
        .execute();
    await db.schema
        .alterTable('groups')
        .addColumn('scim_external_id', 'text')
        .execute();
    await db.schema
        .createIndex('idx_groups_workspace_scim_external_id')
        .ifNotExists()
        .on('groups')
        .columns(['workspace_id', 'scim_external_id'])
        .where('scim_external_id', 'is not', null)
        .unique()
        .execute();
    await db.schema
        .alterTable('groups')
        .addColumn('is_external', 'boolean', (col) => col.notNull().defaultTo(false))
        .execute();
    await (0, kysely_1.sql) `
    UPDATE groups SET is_external = true
    WHERE is_default = false
    AND workspace_id IN (
      SELECT workspace_id FROM auth_providers WHERE group_sync = true
    )
  `.execute(db);
    await db.schema
        .alterTable('workspaces')
        .addColumn('is_scim_enabled', 'boolean', (col) => col.notNull().defaultTo(false))
        .execute();
}
async function down(db) {
    await db.schema.dropTable('scim_tokens').execute();
    await db.schema.dropIndex('idx_users_workspace_scim_external_id').execute();
    await db.schema.alterTable('users').dropColumn('scim_external_id').execute();
    await db.schema.dropIndex('idx_groups_workspace_scim_external_id').execute();
    await db.schema.alterTable('groups').dropColumn('scim_external_id').execute();
    await db.schema.alterTable('groups').dropColumn('is_external').execute();
    await db.schema
        .alterTable('workspaces')
        .dropColumn('is_scim_enabled')
        .execute();
}
//# sourceMappingURL=20260501T092214-scim.js.map