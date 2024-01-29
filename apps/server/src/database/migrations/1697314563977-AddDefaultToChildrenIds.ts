import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDefaultToChildrenIds1697314563977 implements MigrationInterface {
    name = 'AddDefaultToChildrenIds1697314563977'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "page_ordering" ADD "deletedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "page_ordering" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "page_ordering" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "page_ordering" ALTER COLUMN "childrenIds" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "page_ordering" ALTER COLUMN "childrenIds" SET DEFAULT ARRAY[]::uuid[]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "page_ordering" ALTER COLUMN "childrenIds" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "page_ordering" ALTER COLUMN "childrenIds" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "page_ordering" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "page_ordering" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "page_ordering" DROP COLUMN "deletedAt"`);
    }

}
