import { MigrationInterface, QueryRunner } from "typeorm";

export class PageOrdering1697150118968 implements MigrationInterface {
    name = 'PageOrdering1697150118968'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "page_ordering" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entityId" uuid NOT NULL, "entityType" character varying(50) NOT NULL, "childrenIds" uuid array NOT NULL DEFAULT '{}', "workspaceId" uuid NOT NULL, "deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e6cab6ffd743697e73340ab10d5" UNIQUE ("entityId", "entityType"), CONSTRAINT "PK_9e76aa1ebbdb85f27813865a058" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "page_ordering" ADD CONSTRAINT "FK_d08d863564fa1d5ed7a45d0e4ff" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "page_ordering" DROP CONSTRAINT "FK_d08d863564fa1d5ed7a45d0e4ff"`);
        await queryRunner.query(`DROP TABLE "page_ordering"`);
    }

}
