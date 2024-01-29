import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTsvectorColumn1706450034470 implements MigrationInterface {
    name = 'AddTsvectorColumn1706450034470'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" ADD "tsv" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(pages.title, '')), 'A') || setweight(to_tsvector('english', coalesce(pages."textContent", '')), 'B')) STORED`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`, ["","public","pages","GENERATED_COLUMN","tsv","setweight(to_tsvector('english', coalesce(pages.title, '')), 'A') || setweight(to_tsvector('english', coalesce(pages.\"textContent\", '')), 'B')"]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`, ["GENERATED_COLUMN","tsv","","public","pages"]);
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "tsv"`);
    }

}
