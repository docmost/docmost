CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`key` text NOT NULL,
	`expires_at` text,
	`last_used_at` text,
	`creator_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `api_keys_workspace_idx` ON `api_keys` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `api_keys_creator_idx` ON `api_keys` (`creator_id`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer,
	`file_ext` text NOT NULL,
	`mime_type` text,
	`type` text,
	`text_content` text,
	`creator_id` text NOT NULL,
	`page_id` text,
	`space_id` text,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attachments_page_idx` ON `attachments` (`page_id`);--> statement-breakpoint
CREATE INDEX `attachments_space_idx` ON `attachments` (`space_id`);--> statement-breakpoint
CREATE INDEX `attachments_workspace_idx` ON `attachments` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `attachments_creator_idx` ON `attachments` (`creator_id`);--> statement-breakpoint
CREATE TABLE `file_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text,
	`status` text DEFAULT 'pending',
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_ext` text,
	`file_size` integer,
	`source` text,
	`error_message` text,
	`creator_id` text,
	`space_id` text,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `file_tasks_workspace_idx` ON `file_tasks` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `file_tasks_status_idx` ON `file_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `file_tasks_creator_idx` ON `file_tasks` (`creator_id`);--> statement-breakpoint
CREATE TABLE `auth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`auth_provider_id` text,
	`provider_user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auth_provider_id`) REFERENCES `auth_providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `auth_accounts_user_idx` ON `auth_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_accounts_provider_idx` ON `auth_accounts` (`auth_provider_id`);--> statement-breakpoint
CREATE INDEX `auth_accounts_workspace_idx` ON `auth_accounts` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `auth_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`settings` text,
	`is_enabled` integer DEFAULT false NOT NULL,
	`allow_signup` integer DEFAULT false NOT NULL,
	`group_sync` integer DEFAULT false NOT NULL,
	`ldap_url` text,
	`ldap_base_dn` text,
	`ldap_bind_dn` text,
	`ldap_bind_password` text,
	`ldap_tls_enabled` integer,
	`ldap_tls_ca_cert` text,
	`ldap_user_search_filter` text,
	`ldap_user_attributes` text,
	`ldap_config` text,
	`oidc_client_id` text,
	`oidc_client_secret` text,
	`oidc_issuer` text,
	`saml_certificate` text,
	`saml_url` text,
	`creator_id` text,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `auth_providers_workspace_idx` ON `auth_providers` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `auth_providers_type_idx` ON `auth_providers` (`type`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text,
	`selection` text,
	`type` text,
	`page_id` text NOT NULL,
	`parent_comment_id` text,
	`creator_id` text,
	`last_edited_by_id` text,
	`edited_at` text,
	`resolved_at` text,
	`resolved_by_id` text,
	`space_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_edited_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `comments_page_idx` ON `comments` (`page_id`);--> statement-breakpoint
CREATE INDEX `comments_workspace_idx` ON `comments` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `comments_creator_idx` ON `comments` (`creator_id`);--> statement-breakpoint
CREATE INDEX `comments_parent_idx` ON `comments` (`parent_comment_id`);--> statement-breakpoint
CREATE TABLE `group_users` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `group_users_group_idx` ON `group_users` (`group_id`);--> statement-breakpoint
CREATE INDEX `group_users_user_idx` ON `group_users` (`user_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_default` integer DEFAULT false NOT NULL,
	`creator_id` text,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `groups_workspace_idx` ON `groups` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `groups_name_workspace_idx` ON `groups` (`name`,`workspace_id`);--> statement-breakpoint
CREATE TABLE `workspace_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`role` text DEFAULT 'member' NOT NULL,
	`token` text NOT NULL,
	`group_ids` text,
	`invited_by_id` text,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invitations_token_idx` ON `workspace_invitations` (`token`);--> statement-breakpoint
CREATE INDEX `workspace_invitations_workspace_idx` ON `workspace_invitations` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`description` text,
	`logo` text,
	`hostname` text,
	`custom_domain` text,
	`settings` text,
	`default_role` text DEFAULT 'member' NOT NULL,
	`email_domains` text,
	`default_space_id` text,
	`status` text,
	`plan` text,
	`trial_end_at` text,
	`enforce_sso` integer DEFAULT false NOT NULL,
	`enforce_mfa` integer,
	`license_key` text,
	`billing_email` text,
	`stripe_customer_id` text,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_hostname_idx` ON `workspaces` (`hostname`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_custom_domain_idx` ON `workspaces` (`custom_domain`);--> statement-breakpoint
CREATE TABLE `user_mfa` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`method` text DEFAULT 'totp' NOT NULL,
	`secret` text,
	`backup_codes` text,
	`is_enabled` integer,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_mfa_user_idx` ON `user_mfa` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`type` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text,
	`used_at` text,
	`workspace_id` text,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_tokens_token_idx` ON `user_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `user_tokens_user_idx` ON `user_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`password` text,
	`role` text,
	`avatar_url` text,
	`email_verified_at` text,
	`last_login_at` text,
	`last_active_at` text,
	`deactivated_at` text,
	`locale` text,
	`timezone` text,
	`settings` text,
	`has_generated_password` integer,
	`invited_by_id` text,
	`workspace_id` text,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `users_workspace_idx` ON `users` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `users_email_workspace_idx` ON `users` (`email`,`workspace_id`);--> statement-breakpoint
CREATE TABLE `space_members` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`group_id` text,
	`role` text DEFAULT 'member' NOT NULL,
	`space_id` text NOT NULL,
	`added_by_id` text,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`added_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `space_members_space_idx` ON `space_members` (`space_id`);--> statement-breakpoint
CREATE INDEX `space_members_user_idx` ON `space_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `space_members_group_idx` ON `space_members` (`group_id`);--> statement-breakpoint
CREATE TABLE `spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`slug` text NOT NULL,
	`description` text,
	`logo` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`default_role` text DEFAULT 'member' NOT NULL,
	`settings` text,
	`creator_id` text,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `spaces_workspace_idx` ON `spaces` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `spaces_slug_workspace_idx` ON `spaces` (`slug`,`workspace_id`);--> statement-breakpoint
CREATE TABLE `backlinks` (
	`id` text PRIMARY KEY NOT NULL,
	`source_page_id` text NOT NULL,
	`target_page_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`source_page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `backlinks_source_idx` ON `backlinks` (`source_page_id`);--> statement-breakpoint
CREATE INDEX `backlinks_target_idx` ON `backlinks` (`target_page_id`);--> statement-breakpoint
CREATE INDEX `backlinks_workspace_idx` ON `backlinks` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `page_history` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`title` text,
	`icon` text,
	`cover_photo` text,
	`content` text,
	`text_content` text,
	`ydoc` blob,
	`slug` text,
	`slug_id` text,
	`version` integer,
	`last_updated_by_id` text,
	`contributor_ids` text,
	`space_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `page_history_page_idx` ON `page_history` (`page_id`);--> statement-breakpoint
CREATE INDEX `page_history_workspace_idx` ON `page_history` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`slug_id` text NOT NULL,
	`title` text,
	`icon` text,
	`cover_photo` text,
	`content` text,
	`ydoc` blob,
	`text_content` text,
	`position` text,
	`is_locked` integer DEFAULT false NOT NULL,
	`parent_page_id` text,
	`creator_id` text,
	`last_updated_by_id` text,
	`deleted_by_id` text,
	`contributor_ids` text,
	`space_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`parent_page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deleted_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pages_space_idx` ON `pages` (`space_id`);--> statement-breakpoint
CREATE INDEX `pages_workspace_idx` ON `pages` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `pages_creator_idx` ON `pages` (`creator_id`);--> statement-breakpoint
CREATE INDEX `pages_parent_idx` ON `pages` (`parent_page_id`);--> statement-breakpoint
CREATE INDEX `pages_slug_idx` ON `pages` (`slug_id`);--> statement-breakpoint
CREATE TABLE `shares` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`page_id` text,
	`include_sub_pages` integer,
	`search_indexing` integer,
	`creator_id` text,
	`space_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shares_key_idx` ON `shares` (`key`);--> statement-breakpoint
CREATE INDEX `shares_page_idx` ON `shares` (`page_id`);--> statement-breakpoint
CREATE INDEX `shares_workspace_idx` ON `shares` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`actor_id` text,
	`page_id` text,
	`space_id` text,
	`comment_id` text,
	`data` text,
	`read_at` text,
	`emailed_at` text,
	`archived_at` text,
	`workspace_id` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `notifications_workspace_idx` ON `notifications` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `notifications_page_idx` ON `notifications` (`page_id`);--> statement-breakpoint
CREATE TABLE `watchers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`page_id` text,
	`space_id` text NOT NULL,
	`type` text NOT NULL,
	`added_by_id` text,
	`muted_at` text,
	`workspace_id` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`added_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `watchers_user_idx` ON `watchers` (`user_id`);--> statement-breakpoint
CREATE INDEX `watchers_page_idx` ON `watchers` (`page_id`);--> statement-breakpoint
CREATE INDEX `watchers_space_idx` ON `watchers` (`space_id`);--> statement-breakpoint
CREATE INDEX `watchers_workspace_idx` ON `watchers` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`payload` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`error_message` text,
	`run_at` text,
	`completed_at` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_name_idx` ON `_jobs` (`name`);--> statement-breakpoint
CREATE INDEX `jobs_run_at_idx` ON `_jobs` (`run_at`);