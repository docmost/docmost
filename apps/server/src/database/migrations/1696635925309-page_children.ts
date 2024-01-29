import { MigrationInterface, QueryRunner } from "typeorm";

export class PageChildren1696635925309 implements MigrationInterface {
    name = 'PageChildren1696635925309'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" ADD "children" uuid array NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "children"`);
    }

}
