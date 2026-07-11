"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('auth_providers')
        .addColumn('group_sync', 'boolean', (col) => col.defaultTo(false).notNull())
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('auth_providers')
        .dropColumn('group_sync')
        .execute();
}
//# sourceMappingURL=20250831T191600-add-group-sync-to-auth-providers.js.map