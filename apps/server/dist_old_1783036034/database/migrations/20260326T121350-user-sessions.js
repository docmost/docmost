"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('user_sessions')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
        .addColumn('workspace_id', 'uuid', (col) => col.notNull().references('workspaces.id').onDelete('cascade'))
        .addColumn('device_name', 'varchar')
        .addColumn('user_agent', 'text')
        .addColumn('ip_address', (0, kysely_1.sql) `inet`)
        .addColumn('geo_location', 'varchar')
        .addColumn('last_active_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
        .addColumn('metadata', 'jsonb')
        .addColumn('revoked_at', 'timestamptz')
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .execute();
    await (0, kysely_1.sql) `
    CREATE INDEX idx_user_sessions_active
    ON user_sessions (user_id, workspace_id, last_active_at DESC)
    WHERE revoked_at IS NULL
  `.execute(db);
    await (0, kysely_1.sql) `
    CREATE INDEX idx_user_sessions_revoked
    ON user_sessions (expires_at)
    WHERE revoked_at IS NOT NULL
  `.execute(db);
}
async function down(db) {
    await db.schema.dropTable('user_sessions').execute();
}
//# sourceMappingURL=20260326T121350-user-sessions.js.map