"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('workspaces')
        .addForeignKeyConstraint('workspaces_default_space_id_fkey', ['default_space_id'], 'spaces', ['id'])
        .onDelete('set null')
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('workspaces')
        .dropConstraint('workspaces_default_space_id_fkey')
        .execute();
}
//# sourceMappingURL=20240324T086100-add-workspace-fk.js.map