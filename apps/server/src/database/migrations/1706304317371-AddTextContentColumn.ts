import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTextContentColumn1706304317371 implements MigrationInterface {
    name = 'AddTextContentColumn1706304317371'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" ADD "textContent" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "textContent"`);
    }

}
