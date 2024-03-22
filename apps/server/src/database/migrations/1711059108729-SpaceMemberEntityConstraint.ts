import { MigrationInterface, QueryRunner } from "typeorm";

export class SpaceMemberEntityConstraint1711059108729 implements MigrationInterface {
    name = 'SpaceMemberEntityConstraint1711059108729'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "space_members" ADD CONSTRAINT "CHK_allow_userId_or_groupId" CHECK (("userId" IS NOT NULL AND "groupId" IS NULL) OR ("userId" IS NULL AND "groupId" IS NOT NULL))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "space_members" DROP CONSTRAINT "CHK_allow_userId_or_groupId"`);
    }

}
