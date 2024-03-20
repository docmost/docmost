import { MigrationInterface, QueryRunner } from "typeorm";

export class SpaceGroupsMembership1710892343941 implements MigrationInterface {
    name = 'SpaceGroupsMembership1710892343941'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "space_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "groupId" uuid NOT NULL, "spaceId" uuid NOT NULL, "role" character varying(100), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_68e59d7b983dfefc7d33febe4c3" UNIQUE ("spaceId", "groupId"), CONSTRAINT "PK_31f9b87a8dced378cb68f04836b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "space_groups" ADD CONSTRAINT "FK_b3950d22b51148de9e14a1e5020" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "space_groups" ADD CONSTRAINT "FK_80567cbf54af9e8e8ec469d247d" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "space_groups" DROP CONSTRAINT "FK_80567cbf54af9e8e8ec469d247d"`);
        await queryRunner.query(`ALTER TABLE "space_groups" DROP CONSTRAINT "FK_b3950d22b51148de9e14a1e5020"`);
        await queryRunner.query(`DROP TABLE "space_groups"`);
    }

}
