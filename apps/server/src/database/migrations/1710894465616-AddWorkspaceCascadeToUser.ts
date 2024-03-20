import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceCascadeToUser1710894465616 implements MigrationInterface {
    name = 'AddWorkspaceCascadeToUser1710894465616'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_949fea12b7977a8b2f483bf802a"`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_949fea12b7977a8b2f483bf802a" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_949fea12b7977a8b2f483bf802a"`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_949fea12b7977a8b2f483bf802a" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
