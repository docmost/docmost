import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTsvectorTrigger1711152548283 implements MigrationInterface {
  name = 'AddTsvectorTrigger1711152548283';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
        begin
            new.tsv :=
                      setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
                      setweight(to_tsvector('english', coalesce(new.\"textContent\", '')), 'B');
            return new;
        end;
        $$ LANGUAGE plpgsql;
        `);

    await queryRunner.query(`
            CREATE TRIGGER pages_tsvector_update BEFORE INSERT OR UPDATE
                ON pages FOR EACH ROW EXECUTE FUNCTION pages_tsvector_trigger();
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER pages_tsvector_update ON Pages`);
    await queryRunner.query(`DROP FUNCTION pages_tsvector_trigger`);
  }
}
