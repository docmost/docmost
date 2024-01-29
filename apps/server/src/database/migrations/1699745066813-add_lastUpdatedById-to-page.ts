import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLastUpdatedByIdToPage1699745066813 implements MigrationInterface {
    name = 'AddLastUpdatedByIdToPage1699745066813'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" ADD "lastUpdatedById" uuid`);
        await queryRunner.query(`ALTER TABLE "page_ordering" ALTER COLUMN "childrenIds" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "pages" ADD CONSTRAINT "FK_084265d943e0013761a6d6478e0" FOREIGN KEY ("lastUpdatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" DROP CONSTRAINT "FK_084265d943e0013761a6d6478e0"`);
        await queryRunner.query(`ALTER TABLE "page_ordering" ALTER COLUMN "childrenIds" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "lastUpdatedById"`);
    }

}
