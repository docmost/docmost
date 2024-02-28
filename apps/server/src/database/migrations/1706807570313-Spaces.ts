import { MigrationInterface, QueryRunner } from "typeorm";

export class Spaces1706807570313 implements MigrationInterface {
    name = 'Spaces1706807570313'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "spaces" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255), "description" text, "icon" character varying(255), "hostname" character varying(255), "creatorId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4f0a029f6eefd773fde2143b261" UNIQUE ("hostname"), CONSTRAINT "PK_dbe542974aca57afcb60709d4c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "page_history" ADD "spaceId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pages" ADD "spaceId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "page_ordering" ADD "spaceId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "spaces" ADD CONSTRAINT "FK_8469f60fb94d43a0280a83d0b35" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "spaces" ADD CONSTRAINT "FK_f8c6dec54d8a2fdd26ea036fc8d" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "page_history" ADD CONSTRAINT "FK_8caa9d435480f4390b9885c4bd0" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pages" ADD CONSTRAINT "FK_c4aef9b23f1222bebc5897de72d" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "page_ordering" ADD CONSTRAINT "FK_17f9d5fd14d32a81d58ad747359" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "page_ordering" DROP CONSTRAINT "FK_17f9d5fd14d32a81d58ad747359"`);
        await queryRunner.query(`ALTER TABLE "pages" DROP CONSTRAINT "FK_c4aef9b23f1222bebc5897de72d"`);
        await queryRunner.query(`ALTER TABLE "page_history" DROP CONSTRAINT "FK_8caa9d435480f4390b9885c4bd0"`);
        await queryRunner.query(`ALTER TABLE "spaces" DROP CONSTRAINT "FK_f8c6dec54d8a2fdd26ea036fc8d"`);
        await queryRunner.query(`ALTER TABLE "spaces" DROP CONSTRAINT "FK_8469f60fb94d43a0280a83d0b35"`);
        await queryRunner.query(`ALTER TABLE "page_ordering" DROP COLUMN "spaceId"`);
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "spaceId"`);
        await queryRunner.query(`ALTER TABLE "page_history" DROP COLUMN "spaceId"`);
        await queryRunner.query(`DROP TABLE "spaces"`);
    }

}
