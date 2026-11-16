import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // tsv is only rebuilt when the text changes, so backfills must set tsv directly
  await sql`
    CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
    begin
        if tg_op = 'UPDATE'
            and old.title is not distinct from new.title
            and old.text_content is not distinct from new.text_content then
            return new;
        end if;
        new.tsv :=
                  setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
                  setweight(to_tsvector('english', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`CREATE OR REPLACE TRIGGER pages_tsvector_update
    BEFORE INSERT OR UPDATE OF title, text_content ON pages
    FOR EACH ROW EXECUTE FUNCTION pages_tsvector_trigger()`.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION templates_tsvector_trigger() RETURNS trigger AS $$
    begin
        if tg_op = 'UPDATE'
            and old.title is not distinct from new.title
            and old.text_content is not distinct from new.text_content then
            return new;
        end if;
        new.tsv :=
                  setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
                  setweight(to_tsvector('english', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`CREATE OR REPLACE TRIGGER templates_tsvector_update
    BEFORE INSERT OR UPDATE OF title, text_content ON templates
    FOR EACH ROW EXECUTE FUNCTION templates_tsvector_trigger()`.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION ai_chat_messages_tsvector_trigger() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'UPDATE' AND OLD.content IS NOT DISTINCT FROM NEW.content THEN
        RETURN NEW;
      END IF;
      NEW.tsv := to_tsvector('english', f_unaccent(substring(coalesce(NEW.content, ''), 1, 100000)));
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`CREATE OR REPLACE TRIGGER ai_chat_messages_tsvector_update
    BEFORE INSERT OR UPDATE OF content ON ai_chat_messages
    FOR EACH ROW EXECUTE FUNCTION ai_chat_messages_tsvector_trigger()`.execute(db);

  await db.schema
    .alterTable('attachments')
    .addColumn('indexed_at', 'timestamptz')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('attachments').dropColumn('indexed_at').execute();

  await sql`
    CREATE OR REPLACE FUNCTION ai_chat_messages_tsvector_trigger() RETURNS trigger AS $$
    BEGIN
      NEW.tsv := to_tsvector('english', f_unaccent(substring(coalesce(NEW.content, ''), 1, 100000)));
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`CREATE OR REPLACE TRIGGER ai_chat_messages_tsvector_update
    BEFORE INSERT OR UPDATE ON ai_chat_messages
    FOR EACH ROW EXECUTE FUNCTION ai_chat_messages_tsvector_trigger()`.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION templates_tsvector_trigger() RETURNS trigger AS $$
    begin
        new.tsv :=
                  setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
                  setweight(to_tsvector('english', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`CREATE OR REPLACE TRIGGER templates_tsvector_update
    BEFORE INSERT OR UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION templates_tsvector_trigger()`.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
    begin
        new.tsv :=
                  setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
                  setweight(to_tsvector('english', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`CREATE OR REPLACE TRIGGER pages_tsvector_update
    BEFORE INSERT OR UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION pages_tsvector_trigger()`.execute(db);
}
