import { MigrationInterface, QueryRunner } from "typeorm";

export class Groups1709644512305 implements MigrationInterface {
    name = 'Groups1709644512305'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "group_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "groupId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_129c2cb846b1f4beedf4c6373b5" UNIQUE ("groupId", "userId"), CONSTRAINT "PK_5df8869cdeffc693bd083153bcf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "workspaceId" uuid NOT NULL, "creatorId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_659d1483316afb28afd3a90646e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "group_users" ADD CONSTRAINT "FK_ad937045ed48b757293b2011d36" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_users" ADD CONSTRAINT "FK_ba2d59b482905354e872896dba8" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "FK_cce5e5fec33dae0fcc991795b4a" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "FK_accb24ba8f4f213f33d08e2a20f" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "FK_accb24ba8f4f213f33d08e2a20f"`);
        await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "FK_cce5e5fec33dae0fcc991795b4a"`);
        await queryRunner.query(`ALTER TABLE "group_users" DROP CONSTRAINT "FK_ba2d59b482905354e872896dba8"`);
        await queryRunner.query(`ALTER TABLE "group_users" DROP CONSTRAINT "FK_ad937045ed48b757293b2011d36"`);
        await queryRunner.query(`DROP TABLE "groups"`);
        await queryRunner.query(`DROP TABLE "group_users"`);
    }

}
