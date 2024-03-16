import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeletedAtToWorkspace1710371336371 implements MigrationInterface {
    name = 'AddDeletedAtToWorkspace1710371336371'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "deletedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "deletedAt"`);
    }

}
