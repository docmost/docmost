import { MigrationInterface, QueryRunner } from "typeorm";

export class FixPageOrdering1697314976326 implements MigrationInterface {
    name = 'FixPageOrdering1697314976326'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "page_ordering" ALTER COLUMN "childrenIds" SET DEFAULT ARRAY[]::uuid[]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "page_ordering" ALTER COLUMN "childrenIds" SET DEFAULT ARRAY[]::uuid[]`);
    }

}
