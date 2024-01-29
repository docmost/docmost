import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeContentTypeToJson1694385231850 implements MigrationInterface {
    name = 'ChangeContentTypeToJson1694385231850'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "content"`);
        await queryRunner.query(`ALTER TABLE "pages" ADD "content" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "content"`);
        await queryRunner.query(`ALTER TABLE "pages" ADD "content" text`);
    }

}
