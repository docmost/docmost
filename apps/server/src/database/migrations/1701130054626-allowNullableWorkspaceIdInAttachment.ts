import { MigrationInterface, QueryRunner } from "typeorm";

export class AllowNullableWorkspaceIdInAttachment1701130054626 implements MigrationInterface {
    name = 'AllowNullableWorkspaceIdInAttachment1701130054626'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_324ff4215dd2fdad52a8d5e2dfd"`);
        await queryRunner.query(`ALTER TABLE "attachments" ALTER COLUMN "workspaceId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_324ff4215dd2fdad52a8d5e2dfd" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_324ff4215dd2fdad52a8d5e2dfd"`);
        await queryRunner.query(`ALTER TABLE "attachments" ALTER COLUMN "workspaceId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_324ff4215dd2fdad52a8d5e2dfd" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
