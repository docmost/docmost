import { MigrationInterface, QueryRunner } from "typeorm";

export class Comments1698947225315 implements MigrationInterface {
    name = 'Comments1698947225315'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "selection" character varying(255), "type" character varying(55), "creatorId" uuid NOT NULL, "pageId" uuid NOT NULL, "parentCommentId" uuid, "resolvedById" uuid, "resolvedAt" TIMESTAMP, "workspaceId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "editedAt" TIMESTAMP, "deletedAt" TIMESTAMP, CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "page_ordering" ALTER COLUMN "childrenIds" SET DEFAULT ARRAY[]::uuid[]`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_0b42c764851bcb3ffae634792bc" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_824db5aaea3cd415ff5c4074f03" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_4875672591221a61ace66f2d4f9" FOREIGN KEY ("parentCommentId") REFERENCES "comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_79d04b0fd3e4be189fd14d5ff87" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_9e54f4464009dbc27921fd5f166" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_9e54f4464009dbc27921fd5f166"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_79d04b0fd3e4be189fd14d5ff87"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_4875672591221a61ace66f2d4f9"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_824db5aaea3cd415ff5c4074f03"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_0b42c764851bcb3ffae634792bc"`);
        await queryRunner.query(`ALTER TABLE "page_ordering" ALTER COLUMN "childrenIds" SET DEFAULT ARRAY[]::uuid[]`);
        await queryRunner.query(`DROP TABLE "comments"`);
    }

}
