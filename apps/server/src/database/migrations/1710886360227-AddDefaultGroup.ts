import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDefaultGroup1710886360227 implements MigrationInterface {
    name = 'AddDefaultGroup1710886360227'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "groups" ADD "isDefault" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "FK_accb24ba8f4f213f33d08e2a20f"`);
        await queryRunner.query(`ALTER TABLE "groups" ALTER COLUMN "creatorId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "UQ_c092c7c01795e6ad7af46bf2d24" UNIQUE ("name", "workspaceId")`);
        await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "FK_accb24ba8f4f213f33d08e2a20f" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "FK_accb24ba8f4f213f33d08e2a20f"`);
        await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "UQ_c092c7c01795e6ad7af46bf2d24"`);
        await queryRunner.query(`ALTER TABLE "groups" ALTER COLUMN "creatorId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "FK_accb24ba8f4f213f33d08e2a20f" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "groups" DROP COLUMN "isDefault"`);
    }

}
