"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('pages')
        .addColumn('metadata', 'jsonb', (col) => col.notNull().defaultTo('{}'))
        .execute();
}
async function down(db) {
    await db.schema.alterTable('pages').dropColumn('metadata').execute();
}
//# sourceMappingURL=20260618T120000-add-metadata-to-pages.js.map