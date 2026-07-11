"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema.dropIndex('pages_slug_id_idx').ifExists().execute();
}
async function down(db) { }
//# sourceMappingURL=20240707T145623-drop-redundant-pages-slug_id-index.js.map