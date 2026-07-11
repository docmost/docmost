"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema.alterTable('spaces').addColumn('settings', 'jsonb').execute();
}
async function down(db) {
    await db.schema.alterTable('spaces').dropColumn('settings').execute();
}
//# sourceMappingURL=20260205T214213-add-settings-to-spaces.js.map