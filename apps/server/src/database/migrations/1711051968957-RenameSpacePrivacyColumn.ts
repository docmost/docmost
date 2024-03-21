import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameSpacePrivacyColumn1711051968957 implements MigrationInterface {
    name = 'RenameSpacePrivacyColumn1711051968957'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "spaces" RENAME COLUMN "privacy" TO "visibility"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "spaces" RENAME COLUMN "visibility" TO "privacy"`);
    }

}
