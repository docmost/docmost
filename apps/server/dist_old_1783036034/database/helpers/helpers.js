"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPageEmbeddingsTableExists = isPageEmbeddingsTableExists;
exports.tableExists = tableExists;
const kysely_1 = require("kysely");
async function isPageEmbeddingsTableExists(db) {
    return tableExists({ db, tableName: 'page_embeddings' });
}
async function tableExists(opts) {
    const { db, tableName } = opts;
    const result = await (0, kysely_1.sql) `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = COALESCE(current_schema(), 'public')
        AND table_name = ${tableName}
      ) as exists
    `.execute(db);
    return result.rows[0]?.exists ?? false;
}
//# sourceMappingURL=helpers.js.map