import { MigrationInterface, QueryRunner } from "typeorm";

export class UniqueUser1710530661379 implements MigrationInterface {
    name = 'UniqueUser1710530661379'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_b368db80982a952e3071e008a2c" UNIQUE ("email", "workspaceId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_b368db80982a952e3071e008a2c"`);
    }

}
