import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorWorkspaceUser1710168946001 implements MigrationInterface {
    name = 'RefactorWorkspaceUser1710168946001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP CONSTRAINT "FK_2aab2dd12dc65eb183d99b953e0"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "role" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "workspaceId" uuid`);
        await queryRunner.query(`ALTER TABLE "workspaces" ALTER COLUMN "creatorId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_949fea12b7977a8b2f483bf802a" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_949fea12b7977a8b2f483bf802a"`);
        await queryRunner.query(`ALTER TABLE "workspaces" ALTER COLUMN "creatorId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "workspaceId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD CONSTRAINT "FK_2aab2dd12dc65eb183d99b953e0" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
