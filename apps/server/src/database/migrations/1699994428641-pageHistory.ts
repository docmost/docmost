import { MigrationInterface, QueryRunner } from "typeorm";

export class PageHistory1699994428641 implements MigrationInterface {
    name = 'PageHistory1699994428641'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "page_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pageId" uuid NOT NULL, "title" character varying(500), "content" jsonb, "slug" character varying, "icon" character varying, "coverPhoto" character varying, "version" integer NOT NULL, "lastUpdatedById" uuid NOT NULL, "workspaceId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_691fc6c1929979d997d632fce15" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "page_history" ADD CONSTRAINT "FK_aa0d880237a50235094b861fa10" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "page_history" ADD CONSTRAINT "FK_7be5dfbbbb81607688a5032516d" FOREIGN KEY ("lastUpdatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "page_history" ADD CONSTRAINT "FK_9cc322c0c40d5d3356911e24ce0" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "page_history" DROP CONSTRAINT "FK_9cc322c0c40d5d3356911e24ce0"`);
        await queryRunner.query(`ALTER TABLE "page_history" DROP CONSTRAINT "FK_7be5dfbbbb81607688a5032516d"`);
        await queryRunner.query(`ALTER TABLE "page_history" DROP CONSTRAINT "FK_aa0d880237a50235094b861fa10"`);
        await queryRunner.query(`DROP TABLE "page_history"`);
    }

}
