"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('audit')
        .ifNotExists()
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('workspace_id', 'uuid', (col) => col.notNull().references('workspaces.id').onDelete('cascade'))
        .addColumn('actor_id', 'uuid')
        .addColumn('actor_type', 'varchar', (col) => col.notNull().defaultTo('user'))
        .addColumn('event', 'varchar', (col) => col.notNull())
        .addColumn('resource_type', 'varchar', (col) => col.notNull())
        .addColumn('resource_id', 'uuid')
        .addColumn('space_id', 'uuid')
        .addColumn('changes', 'jsonb')
        .addColumn('metadata', 'jsonb')
        .addColumn('ip_address', (0, kysely_1.sql) `inet`)
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .execute();
    await db.schema
        .createIndex('idx_audit_workspace_id')
        .ifNotExists()
        .on('audit')
        .columns(['workspace_id', 'id desc'])
        .execute();
    await db.schema
        .alterTable('workspaces')
        .addColumn('audit_retention_days', 'int8', (col) => col)
        .execute();
    await db.schema
        .alterTable('workspaces')
        .addColumn('trash_retention_days', 'int8', (col) => col)
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('workspaces')
        .dropColumn('audit_retention_days')
        .execute();
    await db.schema
        .alterTable('workspaces')
        .dropColumn('trash_retention_days')
        .execute();
    await db.schema.dropTable('audit').execute();
}
//# sourceMappingURL=20260228T223532-audit.js.map