import { MigrationInterface, QueryRunner } from "typeorm";

export class AddYdoc1694305155156 implements MigrationInterface {
    name = 'AddYdoc1694305155156'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" RENAME COLUMN "json" TO "ydoc"`);
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "ydoc"`);
        await queryRunner.query(`ALTER TABLE "pages" ADD "ydoc" bytea`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "ydoc"`);
        await queryRunner.query(`ALTER TABLE "pages" ADD "ydoc" jsonb`);
        await queryRunner.query(`ALTER TABLE "pages" RENAME COLUMN "ydoc" TO "json"`);
    }

}
