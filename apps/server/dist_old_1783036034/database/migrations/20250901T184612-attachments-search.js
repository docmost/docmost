"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .alterTable('attachments')
        .addColumn('text_content', 'text', (col) => col)
        .addColumn('tsv', (0, kysely_1.sql) `tsvector`, (col) => col)
        .execute();
    await db.schema
        .createIndex('attachments_tsv_idx')
        .on('attachments')
        .using('GIN')
        .column('tsv')
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('attachments')
        .dropIndex('attachments_tsv_idx')
        .execute();
    await db.schema
        .alterTable('attachments')
        .dropColumn('text_content')
        .dropColumn('tsv')
        .execute();
}
//# sourceMappingURL=20250901T184612-attachments-search.js.map