"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await (0, kysely_1.sql) `CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
        begin
            new.tsv :=
                      setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
                      setweight(to_tsvector('english', coalesce(new.text_content, '')), 'B');
            return new;
        end;
        $$ LANGUAGE plpgsql;`.execute(db);
    await (0, kysely_1.sql) `CREATE OR REPLACE TRIGGER pages_tsvector_update BEFORE INSERT OR UPDATE
                ON pages FOR EACH ROW EXECUTE FUNCTION pages_tsvector_trigger();`.execute(db);
}
async function down(db) {
    await (0, kysely_1.sql) `DROP trigger pages_tsvector_update ON pages`.execute(db);
    await (0, kysely_1.sql) `DROP FUNCTION pages_tsvector_trigger`.execute(db);
}
//# sourceMappingURL=20240324T086800-pages-tsvector-trigger.js.map