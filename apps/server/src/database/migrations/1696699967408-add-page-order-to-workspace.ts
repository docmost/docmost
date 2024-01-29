import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPageOrderToWorkspace1696699967408 implements MigrationInterface {
    name = 'AddPageOrderToWorkspace1696699967408'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "pageOrder" uuid array NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "pageOrder"`);
    }

}
