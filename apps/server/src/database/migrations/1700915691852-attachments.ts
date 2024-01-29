import { MigrationInterface, QueryRunner } from "typeorm";

export class Attachments1700915691852 implements MigrationInterface {
    name = 'Attachments1700915691852'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fileName" character varying(255) NOT NULL, "filePath" character varying NOT NULL, "fileSize" bigint NOT NULL, "fileExt" character varying(55) NOT NULL, "mimeType" character varying(255) NOT NULL, "type" character varying(55) NOT NULL, "creatorId" uuid NOT NULL, "pageId" uuid, "workspaceId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_5e1f050bcff31e3084a1d662412" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_daa9e88b284de90deec949dd18a" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_60c2231004f3ca0e1808960eaf4" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_324ff4215dd2fdad52a8d5e2dfd" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_324ff4215dd2fdad52a8d5e2dfd"`);
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_60c2231004f3ca0e1808960eaf4"`);
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_daa9e88b284de90deec949dd18a"`);
        await queryRunner.query(`DROP TABLE "attachments"`);
    }

}
