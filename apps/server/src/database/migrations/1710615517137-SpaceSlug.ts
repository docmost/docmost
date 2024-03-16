import { MigrationInterface, QueryRunner } from "typeorm";

export class SpaceSlug1710615517137 implements MigrationInterface {
    name = 'SpaceSlug1710615517137'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "spaces" ADD "slug" character varying`);
        await queryRunner.query(`ALTER TABLE "spaces" ADD CONSTRAINT "UQ_c58549749e7a141746940d01f39" UNIQUE ("slug", "workspaceId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "spaces" DROP CONSTRAINT "UQ_c58549749e7a141746940d01f39"`);
        await queryRunner.query(`ALTER TABLE "spaces" DROP COLUMN "slug"`);
    }

}
