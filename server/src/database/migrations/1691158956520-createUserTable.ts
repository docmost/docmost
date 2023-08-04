import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTable1691158956520 implements MigrationInterface {
  name = 'CreateUserTable1691158956520';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "email" character varying NOT NULL, "emailVerifiedAt" TIMESTAMP, "password" character varying NOT NULL, "avatar_url" character varying, "locale" character varying, "timezone" character varying, "settings" jsonb, "lastLoginAt" TIMESTAMP, "lastLoginIp" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
