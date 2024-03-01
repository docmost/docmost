import { MigrationInterface, QueryRunner } from "typeorm";

export class DefaultSpace1709215284760 implements MigrationInterface {
    name = 'DefaultSpace1709215284760'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "defaultSpaceId" uuid`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD CONSTRAINT "UQ_e91d3ec686ece9654aa9f635981" UNIQUE ("defaultSpaceId")`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD CONSTRAINT "FK_e91d3ec686ece9654aa9f635981" FOREIGN KEY ("defaultSpaceId") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP CONSTRAINT "FK_e91d3ec686ece9654aa9f635981"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP CONSTRAINT "UQ_e91d3ec686ece9654aa9f635981"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "defaultSpaceId"`);
    }

}
