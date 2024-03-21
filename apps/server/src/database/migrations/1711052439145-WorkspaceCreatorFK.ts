import { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceCreatorFK1711052439145 implements MigrationInterface {
    name = 'WorkspaceCreatorFK1711052439145'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ADD CONSTRAINT "UQ_2aab2dd12dc65eb183d99b953e0" UNIQUE ("creatorId")`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD CONSTRAINT "FK_2aab2dd12dc65eb183d99b953e0" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP CONSTRAINT "FK_2aab2dd12dc65eb183d99b953e0"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP CONSTRAINT "UQ_2aab2dd12dc65eb183d99b953e0"`);
        await queryRunner.query(`ALTER TABLE "spaces" RENAME COLUMN "visibility" TO "privacy"`);
    }

}
