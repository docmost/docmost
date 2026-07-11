"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await (0, kysely_1.sql) `CREATE EXTENSION IF NOT EXISTS unaccent`.execute(db);
    await (0, kysely_1.sql) `CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);
    await (0, kysely_1.sql) `
    CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
    AS $$
      SELECT unaccent('unaccent', $1);
    $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;
  `.execute(db);
    await (0, kysely_1.sql) `
    CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
    begin
        new.tsv :=
                  setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
                  setweight(to_tsvector('english', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);
}
async function down(db) {
    await (0, kysely_1.sql) `
    CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
    begin
        new.tsv :=
                  setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
                  setweight(to_tsvector('english', coalesce(new.text_content, '')), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);
    await (0, kysely_1.sql) `DROP FUNCTION IF EXISTS f_unaccent(text)`.execute(db);
    await (0, kysely_1.sql) `DROP EXTENSION IF EXISTS pg_trgm`.execute(db);
    await (0, kysely_1.sql) `DROP EXTENSION IF EXISTS unaccent`.execute(db);
}
//# sourceMappingURL=20250729T213756-add-unaccent-pg_trm-update-tsvector..js.map