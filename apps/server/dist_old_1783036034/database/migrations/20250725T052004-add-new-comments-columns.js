"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .alterTable('comments')
        .addColumn('last_edited_by_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
        .execute();
    await db.schema
        .alterTable('comments')
        .addColumn('resolved_by_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
        .execute();
    await db.schema
        .alterTable('comments')
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .execute();
    await db.schema
        .alterTable('comments')
        .addColumn('space_id', 'uuid', (col) => col.references('spaces.id').onDelete('cascade'))
        .execute();
    await db
        .updateTable('comments as c')
        .set((eb) => ({
        space_id: eb.ref('p.space_id'),
    }))
        .from('pages as p')
        .whereRef('c.page_id', '=', 'p.id')
        .execute();
    await db.schema
        .alterTable('comments')
        .alterColumn('space_id', (col) => col.setNotNull())
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('comments')
        .dropColumn('last_edited_by_id')
        .execute();
    await db.schema.alterTable('comments').dropColumn('resolved_by_id').execute();
    await db.schema.alterTable('comments').dropColumn('updated_at').execute();
    await db.schema.alterTable('comments').dropColumn('space_id').execute();
}
//# sourceMappingURL=20250725T052004-add-new-comments-columns.js.map