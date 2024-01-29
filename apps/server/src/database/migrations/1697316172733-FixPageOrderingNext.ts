import { MigrationInterface, QueryRunner } from "typeorm";

export class FixPageOrderingNext1697316172733 implements MigrationInterface {
    name = 'FixPageOrderingNext1697316172733'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "children"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "pageOrder"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "pageOrder" uuid array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "pages" ADD "children" uuid array NOT NULL DEFAULT '{}'`);
    }

}
