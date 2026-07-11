"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await (0, kysely_1.sql) `
    INSERT INTO watchers (user_id, page_id, space_id, workspace_id, type, added_by_id)
    SELECT DISTINCT
      u.user_id,
      p.id as page_id,
      p.space_id,
      p.workspace_id,
      'page' as type,
      u.user_id as added_by_id
    FROM pages p
    CROSS JOIN LATERAL (
      SELECT unnest(p.contributor_ids) as user_id
      UNION
      SELECT p.creator_id as user_id WHERE p.creator_id IS NOT NULL
    ) u
    WHERE p.deleted_at IS NULL
      AND u.user_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `.execute(db);
}
async function down(db) {
    await (0, kysely_1.sql) `DELETE FROM watchers WHERE type = 'page'`.execute(db);
}
//# sourceMappingURL=20260213T085337-backfill-watchers.js.map