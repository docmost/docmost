import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1693002768219 implements MigrationInterface {
    name = 'Init1693002768219'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "workspace_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "role" character varying(100), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe4f6e13489c4ad1a946910f529" UNIQUE ("workspaceId", "userId"), CONSTRAINT "PK_6d52a8e2739982d783279cffe84" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "pages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(500), "content" text, "html" text, "json" jsonb, "slug" character varying, "icon" character varying, "coverPhoto" character varying, "editor" character varying(255), "shareId" character varying(255), "parentPageId" uuid, "creatorId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "isLocked" boolean NOT NULL DEFAULT false, "status" character varying(255), "publishedAt" date, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_8f21ed625aa34c8391d636b7d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "workspace_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "invitedById" uuid NOT NULL, "email" character varying(255) NOT NULL, "role" character varying(100), "status" character varying(100), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_525b9069dc828a8ee8fdc62c32c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "workspaces" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255), "description" text, "logo" character varying(255), "hostname" character varying(255), "customDomain" character varying(255), "enableInvite" boolean NOT NULL DEFAULT true, "inviteCode" character varying(255), "settings" jsonb, "creatorId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_3e610433bc1050e8b95ba5f40b3" UNIQUE ("hostname"), CONSTRAINT "UQ_a2c9d7a0bc273471872ecdbcfd9" UNIQUE ("inviteCode"), CONSTRAINT "PK_098656ae401f3e1a4586f47fd8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255), "email" character varying(255) NOT NULL, "emailVerifiedAt" TIMESTAMP, "password" character varying NOT NULL, "avatarUrl" character varying, "locale" character varying(100), "timezone" character varying(300), "settings" jsonb, "lastLoginAt" TIMESTAMP, "lastLoginIp" character varying(100), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "workspace_users" ADD CONSTRAINT "FK_70db33ab07e28bfa1fc6011d4ee" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workspace_users" ADD CONSTRAINT "FK_9b226f3cec0ffab646d5607a0c5" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pages" ADD CONSTRAINT "FK_a8c1826f1ff30a4a6afd3344ad5" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pages" ADD CONSTRAINT "FK_2043118dc32860c1a4f02c94dcf" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pages" ADD CONSTRAINT "FK_824728b97cb88f81f00dd333da1" FOREIGN KEY ("parentPageId") REFERENCES "pages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_65515eaafd8282c3848bddbb008" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_5d5dd20ac2ce5f9b80d47ea4f09" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD CONSTRAINT "FK_2aab2dd12dc65eb183d99b953e0" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP CONSTRAINT "FK_2aab2dd12dc65eb183d99b953e0"`);
        await queryRunner.query(`ALTER TABLE "workspace_invitations" DROP CONSTRAINT "FK_5d5dd20ac2ce5f9b80d47ea4f09"`);
        await queryRunner.query(`ALTER TABLE "workspace_invitations" DROP CONSTRAINT "FK_65515eaafd8282c3848bddbb008"`);
        await queryRunner.query(`ALTER TABLE "pages" DROP CONSTRAINT "FK_824728b97cb88f81f00dd333da1"`);
        await queryRunner.query(`ALTER TABLE "pages" DROP CONSTRAINT "FK_2043118dc32860c1a4f02c94dcf"`);
        await queryRunner.query(`ALTER TABLE "pages" DROP CONSTRAINT "FK_a8c1826f1ff30a4a6afd3344ad5"`);
        await queryRunner.query(`ALTER TABLE "workspace_users" DROP CONSTRAINT "FK_9b226f3cec0ffab646d5607a0c5"`);
        await queryRunner.query(`ALTER TABLE "workspace_users" DROP CONSTRAINT "FK_70db33ab07e28bfa1fc6011d4ee"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "workspaces"`);
        await queryRunner.query(`DROP TABLE "workspace_invitations"`);
        await queryRunner.query(`DROP TABLE "pages"`);
        await queryRunner.query(`DROP TABLE "workspace_users"`);
    }

}
