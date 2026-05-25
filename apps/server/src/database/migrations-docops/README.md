# DocOps — Custom Migrations

Database migrations for DocOps-specific entities.

Rules:
- Filename prefix: `docops_` followed by timestamp (e.g. `docops_20260525T000001-offices.ts`)
- Timestamp MUST be posterior to all upstream migrations (latest upstream: 20260509T121236)
- NEVER mix with upstream migrations in `../migrations/`
- Use Kysely migration format (same as upstream)

Entities to migrate (in order):
1. `offices`
2. `services`, `tags`, `service_tags`
3. `change_requests`
4. `change_request_events`
5. `external_refs`
6. `audit_logs` (extends upstream `audit` table)
7. `webhooks_config`
8. ALTER TABLE `users` (add `office_id`, `docops_roles`, `external_id`, `auth_provider`)
9. ALTER TABLE `pages` (add `cr_draft_id`, `current_published_version_id`)
10. ALTER TABLE `page_history` (add `change_request_id`, `is_published_version`, `published_at`, `published_by_id`)
