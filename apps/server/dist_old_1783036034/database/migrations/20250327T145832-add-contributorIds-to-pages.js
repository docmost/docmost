"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .alterTable('pages')
        .addColumn('contributor_ids', (0, kysely_1.sql) `uuid[]`, (col) => col.defaultTo("{}"))
        .execute();
}
async function down(db) {
    await db.schema.alterTable('pages').dropColumn('contributor_ids').execute();
}
//# sourceMappingURL=20250327T145832-add-contributorIds-to-pages.js.map