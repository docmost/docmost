"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('workspaces')
        .addColumn('license_key', 'varchar', (col) => col)
        .execute();
}
async function down(db) {
    await db.schema.alterTable('workspaces').dropColumn('license_key').execute();
}
//# sourceMappingURL=20250222T114520-add_license_key_to_workspace.js.map