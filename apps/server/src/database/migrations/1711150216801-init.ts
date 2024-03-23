import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1711150216801 implements MigrationInterface {
  name = 'Init1711150216801';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" jsonb, "selection" character varying(255), "type" character varying(55), "creatorId" uuid NOT NULL, "pageId" uuid NOT NULL, "parentCommentId" uuid, "resolvedById" uuid, "resolvedAt" TIMESTAMP, "workspaceId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "editedAt" TIMESTAMP, "deletedAt" TIMESTAMP, CONSTRAINT "PK_comments" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "group_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "groupId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_group_users_groupId_userId" UNIQUE ("groupId", "userId"), CONSTRAINT "PK_group_users" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "isDefault" boolean NOT NULL DEFAULT false, "workspaceId" uuid NOT NULL, "creatorId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_groups_name_workspaceId" UNIQUE ("name", "workspaceId"), CONSTRAINT "PK_groups" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "space_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "groupId" uuid, "spaceId" uuid NOT NULL, "role" character varying(100) NOT NULL, "creatorId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_space_members_spaceId_groupId" UNIQUE ("spaceId", "groupId"), CONSTRAINT "UQ_space_members_spaceId_userId" UNIQUE ("spaceId", "userId"), CONSTRAINT "CHK_allow_userId_or_groupId" CHECK (("userId" IS NOT NULL AND "groupId" IS NULL) OR ("userId" IS NULL AND "groupId" IS NOT NULL)), CONSTRAINT "PK_space_members" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "spaces" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255), "description" text, "slug" character varying, "icon" character varying(255), "visibility" character varying(100) NOT NULL DEFAULT 'open', "defaultRole" character varying(100) NOT NULL DEFAULT 'writer', "creatorId" uuid, "workspaceId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_spaces_slug_workspaceId" UNIQUE ("slug", "workspaceId"), CONSTRAINT "PK_spaces" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "page_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pageId" uuid NOT NULL, "title" character varying(500), "content" jsonb, "slug" character varying, "icon" character varying, "coverPhoto" character varying, "version" integer NOT NULL, "lastUpdatedById" uuid NOT NULL, "spaceId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_page_history" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "pages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(500), "icon" character varying, "content" jsonb, "html" text, "textContent" text, "tsv" tsvector, "ydoc" bytea, "slug" character varying, "coverPhoto" character varying, "editor" character varying(255), "shareId" character varying(255), "parentPageId" uuid, "creatorId" uuid NOT NULL, "lastUpdatedById" uuid, "deletedById" uuid, "spaceId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "isLocked" boolean NOT NULL DEFAULT false, "status" character varying(255), "publishedAt" date, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_pages" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_pages_tsv" ON "pages" ("id") `);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255), "email" character varying(255) NOT NULL, "emailVerifiedAt" TIMESTAMP, "password" character varying NOT NULL, "avatarUrl" character varying, "role" character varying(100), "workspaceId" uuid, "locale" character varying(100), "timezone" character varying(300), "settings" jsonb, "lastLoginAt" TIMESTAMP, "lastLoginIp" character varying(100), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_users_email_workspaceId" UNIQUE ("email", "workspaceId"), CONSTRAINT "PK_users" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "workspaces" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255), "description" text, "logo" character varying(255), "hostname" character varying(255), "customDomain" character varying(255), "enableInvite" boolean NOT NULL DEFAULT true, "inviteCode" character varying(255), "settings" jsonb, "defaultRole" character varying NOT NULL DEFAULT 'member', "creatorId" uuid, "defaultSpaceId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_workspaces_hostname" UNIQUE ("hostname"), CONSTRAINT "UQ_workspaces_inviteCode" UNIQUE ("inviteCode"), CONSTRAINT "REL_workspaces_creatorId" UNIQUE ("creatorId"), CONSTRAINT "REL_workspaces_defaultSpaceId" UNIQUE ("defaultSpaceId"), CONSTRAINT "PK_workspaces" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "workspace_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "invitedById" uuid NOT NULL, "email" character varying(255) NOT NULL, "role" character varying(100), "status" character varying(100), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_workspace_invitations" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "page_ordering" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entityId" uuid NOT NULL, "entityType" character varying(50) NOT NULL, "childrenIds" uuid array NOT NULL DEFAULT '{}', "workspaceId" uuid NOT NULL, "spaceId" uuid NOT NULL, "deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_page_ordering_entityId_entityType" UNIQUE ("entityId", "entityType"), CONSTRAINT "PK_page_ordering" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fileName" character varying(255) NOT NULL, "filePath" character varying NOT NULL, "fileSize" bigint NOT NULL, "fileExt" character varying(55) NOT NULL, "mimeType" character varying(255) NOT NULL, "type" character varying(55) NOT NULL, "creatorId" uuid NOT NULL, "pageId" uuid, "workspaceId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_attachments" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_users_creatorId" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_pages_pageId" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_comments_parentCommentId" FOREIGN KEY ("parentCommentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_users_resolvedById" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_workspaces_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_users" ADD CONSTRAINT "FK_group_users_users_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_users" ADD CONSTRAINT "FK_group_users_groups_groupId" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "groups" ADD CONSTRAINT "FK_groups_workspaces_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "groups" ADD CONSTRAINT "FK_groups_users_creatorId" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_members" ADD CONSTRAINT "FK_space_members_users_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_members" ADD CONSTRAINT "FK_space_members_groups_groupId" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_members" ADD CONSTRAINT "FK_space_members_spaces_spaceId" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_members" ADD CONSTRAINT "FK_space_members_users_creatorId" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "spaces" ADD CONSTRAINT "FK_spaces_users_creatorId" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "spaces" ADD CONSTRAINT "FK_spaces_workspaces_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_history" ADD CONSTRAINT "FK_page_history_pages_pageId" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_history" ADD CONSTRAINT "FK_page_history_users_lastUpdatedById" FOREIGN KEY ("lastUpdatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_history" ADD CONSTRAINT "FK_page_history_spaces_spaceId" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_history" ADD CONSTRAINT "FK_page_history_workspaces_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD CONSTRAINT "FK_pages_users_creatorId" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD CONSTRAINT "FK_pages_users_lastUpdatedById" FOREIGN KEY ("lastUpdatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD CONSTRAINT "FK_pages_users_deletedById" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD CONSTRAINT "FK_pages_spaces_spaceId" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD CONSTRAINT "FK_pages_workspaces_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD CONSTRAINT "FK_pages_pages_parentPageId" FOREIGN KEY ("parentPageId") REFERENCES "pages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_workspaces_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD CONSTRAINT "FK_workspaces_users_creatorId" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD CONSTRAINT "FK_workspaces_spaces_defaultSpaceId" FOREIGN KEY ("defaultSpaceId") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_workspace_invitations_workspaces_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_workspace_invitations_users_invitedById" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_ordering" ADD CONSTRAINT "FK_page_ordering_workspaces_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_ordering" ADD CONSTRAINT "FK_page_ordering_spaces_spaceId" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ADD CONSTRAINT "FK_attachments_users_creatorId" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ADD CONSTRAINT "FK_attachments_pages_pageId" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ADD CONSTRAINT "FK_attachments_workspaces_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attachments" DROP CONSTRAINT "FK_attachments_workspaces_workspaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" DROP CONSTRAINT "FK_attachments_pages_pageId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" DROP CONSTRAINT "FK_attachments_users_creatorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_ordering" DROP CONSTRAINT "FK_page_ordering_spaces_spaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_ordering" DROP CONSTRAINT "FK_page_ordering_workspaces_workspaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" DROP CONSTRAINT "FK_workspace_invitations_users_invitedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" DROP CONSTRAINT "FK_workspace_invitations_workspaces_workspaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP CONSTRAINT "FK_workspaces_spaces_defaultSpaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP CONSTRAINT "FK_workspaces_users_creatorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_users_workspaces_workspaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP CONSTRAINT "FK_pages_pages_parentPageId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP CONSTRAINT "FK_pages_workspaces_workspaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP CONSTRAINT "FK_pages_spaces_spaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP CONSTRAINT "FK_pages_users_deletedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP CONSTRAINT "FK_pages_users_lastUpdatedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP CONSTRAINT "FK_pages_users_creatorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_history" DROP CONSTRAINT "FK_page_history_workspaces_workspaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_history" DROP CONSTRAINT "FK_page_history_spaces_spaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_history" DROP CONSTRAINT "FK_page_history_users_lastUpdatedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_history" DROP CONSTRAINT "FK_page_history_pages_pageId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "spaces" DROP CONSTRAINT "FK_spaces_workspaces_workspaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "spaces" DROP CONSTRAINT "FK_spaces_users_creatorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_members" DROP CONSTRAINT "FK_space_members_users_creatorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_members" DROP CONSTRAINT "FK_space_members_spaces_spaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_members" DROP CONSTRAINT "FK_space_members_groups_groupId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_members" DROP CONSTRAINT "FK_space_members_users_userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "groups" DROP CONSTRAINT "FK_groups_users_creatorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "groups" DROP CONSTRAINT "FK_groups_workspaces_workspaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_users" DROP CONSTRAINT "FK_group_users_groups_groupId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_users" DROP CONSTRAINT "FK_group_users_users_userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_workspaces_workspaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_users_resolvedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_comments_parentCommentId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_pages_pageId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_users_creatorId"`,
    );
    await queryRunner.query(`DROP TABLE "attachments"`);
    await queryRunner.query(`DROP TABLE "page_ordering"`);
    await queryRunner.query(`DROP TABLE "workspace_invitations"`);
    await queryRunner.query(`DROP TABLE "workspaces"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "pages"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_pages_id"`);
    await queryRunner.query(`DROP TABLE "page_history"`);
    await queryRunner.query(`DROP TABLE "spaces"`);
    await queryRunner.query(`DROP TABLE "space_members"`);
    await queryRunner.query(`DROP TABLE "groups"`);
    await queryRunner.query(`DROP TABLE "group_users"`);
    await queryRunner.query(`DROP TABLE "comments"`);
  }
}
