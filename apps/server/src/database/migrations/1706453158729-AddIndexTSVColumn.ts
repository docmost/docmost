import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexTSVColumn1706453158729 implements MigrationInterface {
    name = 'AddIndexTSVColumn1706453158729'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX pages_tsv_index ON pages USING GIN ("tsv");`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS pages_tsv_index;`);
    }
}
