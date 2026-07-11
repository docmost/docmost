"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .alterTable('page_history')
        .addColumn('contributor_ids', (0, kysely_1.sql) `uuid[]`, (col) => col.defaultTo('{}'))
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('page_history')
        .dropColumn('contributor_ids')
        .execute();
}
//# sourceMappingURL=20260209T120000-add-contributor_ids-to-page-history.js.map