import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeCommentsContentType1699136384454 implements MigrationInterface {
    name = 'ChangeCommentsContentType1699136384454'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "content"`);
        await queryRunner.query(`ALTER TABLE "comments" ADD "content" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "content"`);
        await queryRunner.query(`ALTER TABLE "comments" ADD "content" text NOT NULL`);
    }

}
