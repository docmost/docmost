import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSpacesUsers1708941651476 implements MigrationInterface {
    name = 'AddSpacesUsers1708941651476'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "space_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "spaceId" uuid NOT NULL, "role" character varying(100), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_5819a4f6b83e86596c57c19e39f" UNIQUE ("spaceId", "userId"), CONSTRAINT "PK_8d03fbe7f6bc26f9ac665250e1d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "space_users" ADD CONSTRAINT "FK_e735cdb3781f344a2dff3083fd5" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "space_users" ADD CONSTRAINT "FK_dae4f7e55306bdcec6ac8f602c1" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "space_users" DROP CONSTRAINT "FK_dae4f7e55306bdcec6ac8f602c1"`);
        await queryRunner.query(`ALTER TABLE "space_users" DROP CONSTRAINT "FK_e735cdb3781f344a2dff3083fd5"`);
        await queryRunner.query(`DROP TABLE "space_users"`);
    }

}
