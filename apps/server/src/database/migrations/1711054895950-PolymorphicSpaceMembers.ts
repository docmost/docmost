import { MigrationInterface, QueryRunner } from "typeorm";

export class PolymorphicSpaceMembers1711054895950 implements MigrationInterface {
    name = 'PolymorphicSpaceMembers1711054895950'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "space_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "groupId" uuid, "spaceId" uuid NOT NULL, "role" character varying(100) NOT NULL, "creatorId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_07add45942b705c4b8c6c88013d" UNIQUE ("spaceId", "groupId"), CONSTRAINT "UQ_e91b442c5a1c7aa13c767c88363" UNIQUE ("spaceId", "userId"), CONSTRAINT "PK_5aaa6440d7f1e8b8c051df43d5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "space_members" ADD CONSTRAINT "FK_6b3b64db93d9a721ff7005eb6a3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "space_members" ADD CONSTRAINT "FK_1677eab7e3f6602e13ca23418f5" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "space_members" ADD CONSTRAINT "FK_25571cab1e221c0278499f4e801" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "space_members" ADD CONSTRAINT "FK_63ce441685d52339875a4a33b7e" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "space_members" DROP CONSTRAINT "FK_63ce441685d52339875a4a33b7e"`);
        await queryRunner.query(`ALTER TABLE "space_members" DROP CONSTRAINT "FK_25571cab1e221c0278499f4e801"`);
        await queryRunner.query(`ALTER TABLE "space_members" DROP CONSTRAINT "FK_1677eab7e3f6602e13ca23418f5"`);
        await queryRunner.query(`ALTER TABLE "space_members" DROP CONSTRAINT "FK_6b3b64db93d9a721ff7005eb6a3"`);
        await queryRunner.query(`DROP TABLE "space_members"`);
    }

}
