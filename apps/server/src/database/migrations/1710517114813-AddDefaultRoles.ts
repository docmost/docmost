import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDefaultRoles1710517114813 implements MigrationInterface {
    name = 'AddDefaultRoles1710517114813'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "spaces" DROP CONSTRAINT "UQ_4f0a029f6eefd773fde2143b261"`);
        await queryRunner.query(`ALTER TABLE "spaces" DROP COLUMN "hostname"`);
        await queryRunner.query(`ALTER TABLE "spaces" ADD "privacy" character varying(100) NOT NULL DEFAULT 'open'`);
        await queryRunner.query(`ALTER TABLE "spaces" ADD "defaultRole" character varying(100) NOT NULL DEFAULT 'writer'`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "defaultRole" character varying NOT NULL DEFAULT 'member'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "defaultRole"`);
        await queryRunner.query(`ALTER TABLE "spaces" DROP COLUMN "defaultRole"`);
        await queryRunner.query(`ALTER TABLE "spaces" DROP COLUMN "privacy"`);
        await queryRunner.query(`ALTER TABLE "spaces" ADD "hostname" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "spaces" ADD CONSTRAINT "UQ_4f0a029f6eefd773fde2143b261" UNIQUE ("hostname")`);
    }

}
