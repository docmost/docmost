# Tasks

## Active

- [ ] **[ANALYSIS] Review all EE features** - Document all 23 EE features and their requirements
  - 23 features identified: SSO (custom, Google), MFA, API Keys, Comment Resolution, Page Permissions, Imports (Confluence, DOCX, PDF), Attachment Indexing, Security Settings, MCP, SCIM, Page Verification, Audit Logs, Retention, Sharing Controls, Templates, PDF Export, Personal Spaces, DOCX Export, Bases
  - Note: AI Chat feature removed from implementation plan

- [ ] **[DESIGN] Create EE module architecture** - Plan folder structure and module organization
  - Design sub-modules for each feature area
  - Plan shared utilities and base classes
  - Document dependency graph

- [ ] **[SETUP] Create ee.module.ts and ee.controller.ts** - Foundation for EE system
  - Create `/apps/server/src/ee/ee.module.ts`
  - Create `/apps/server/src/ee/ee.controller.ts`
  - Setup module imports and exports
  - Register with AppModule

## Priority 1: Core Infrastructure

- [ ] **[API-KEYS] Implement API Key management endpoints**
  - POST `/api-keys` - List API keys (paginated)
  - POST `/api-keys/create` - Create new API key
  - POST `/api-keys/update` - Update API key metadata
  - POST `/api-keys/revoke` - Revoke API key
  - Create `ApiKey` entity and repository
  - Create `ApiKeyService` with CRUD operations

- [ ] **[AUDIT] Implement Audit Log endpoints**
  - POST `/audit` - List audit logs (paginated, filterable)
  - POST `/audit/retention` - Get current retention policy
  - POST `/audit/retention/update` - Update retention days
  - Create `AuditLog` query controller
  - Enhance `AuditService` with query capabilities
  - Add retention cleanup job

- [ ] **[MFA] Implement MFA endpoints**
  - POST `/mfa/status` - Get MFA status for user
  - POST `/mfa/setup` - Generate MFA setup (QR code, secret)
  - POST `/mfa/enable` - Enable MFA with verification
  - POST `/mfa/disable` - Disable MFA
  - POST `/mfa/backup-codes` - Generate backup codes
  - POST `/mfa/verify` - Verify MFA code during login
  - POST `/mfa/validate-access` - Validate MFA for sensitive operations
  - Create `UserMfa` entity and repository
  - Create `MfaService` with TOTP logic

## Priority 2: Feature APIs

- [ ] **[PAGE-PERM] Implement Page Permission endpoints**
  - POST `/pages/restrict` - Restrict page access
  - POST `/pages/remove-restriction` - Remove restriction
  - POST `/pages/add-permission` - Grant permission to user/group
  - POST `/pages/remove-permission` - Revoke permission
  - POST `/pages/update-permission` - Update permission role
  - POST `/pages/permission-members` - List users with permissions
  - POST `/pages/permission-info` - Get page restriction info
  - Leverage existing `page_access` and `page_permissions` migrations
  - Create `PagePermissionService`

- [ ] **[SSO] Implement SSO endpoints (Custom + Google)**
  - POST `/sso/create` - Create SSO provider
  - POST `/sso/info` - Get SSO config
  - POST `/sso/update` - Update provider
  - POST `/sso/delete` - Delete provider
  - POST `/sso/providers` - List providers
  - POST `/api/sso/oidc/callback` - OIDC callback (fixed URL, no UUID)
  - Create `SsoProvider` entity and repository
  - Create `SsoService` with OIDC logic

- [ ] **[PAGE-VERIFY] Implement Page Verification endpoints**
  - Page verification/signing functionality
  - Verification status endpoints
  - Create `PageVerification` entity if needed

- [ ] **[TEMPLATES] Implement Templates endpoints**
  - Create, list, update, delete templates
  - Template sharing and permissions
  - Template preview/metadata endpoints

## Priority 3: Integration Features

- [ ] **[SECURITY] Implement Security Settings endpoints**
  - Security policy endpoints
  - Password requirements configuration
  - Session/authentication settings

- [ ] **[SCIM] Implement SCIM provisioning**
  - SCIM 2.0 endpoints for user/group provisioning
  - Create dedicated SCIM service layer

- [ ] **[SHARING-CONTROLS] Implement Sharing Controls**
  - Workspace-level sharing policies
  - Link sharing restrictions
  - Public sharing settings

- [ ] **[SSO] Implement SSO configuration**
  - OIDC/SAML configuration endpoints
  - Google SSO setup
  - Custom SSO provider configuration

## Priority 4: Data & Exports

- [ ] **[DOCX-EXPORT] Implement DOCX Export endpoints**
  - POST `/pages/export/docx` - Export page as DOCX
  - Batch export functionality
  - Create `DocxExportService`

- [ ] **[PDF-EXPORT] Implement PDF Export endpoints**
  - POST `/pages/export/pdf` - Export page as PDF
  - Batch export functionality
  - Create `PdfExportService`

- [ ] **[CONFLUENCE-IMPORT] Implement Confluence Import**
  - Leverage existing import infrastructure
  - Confluence-specific adapters

- [ ] **[ATTACHMENT-INDEXING] Implement Attachment Indexing**
  - Search indexing for attachments
  - Full-text search integration

- [ ] **[RETENTION] Implement Data Retention policies**
  - Retention policy enforcement
  - Automatic cleanup jobs
  - Audit trail retention

## Priority 5: Space & Collection Features

- [ ] **[PERSONAL-SPACE] Implement Personal Spaces**
  - User personal space creation
  - Personal space permissions
  - Personal space isolation

- [ ] **[BASES] Implement Bases/Database feature**
  - Table/database view support
  - Formula evaluation
  - Grid operations

- [ ] **[COMMENT] Implement Advanced Comment features**
  - Comment resolution status
  - Viewer-only comments
  - Comment threads

## Priority 6: Cloud/Billing

- [ ] **[BILLING] Implement Billing integration**
  - Subscription management
  - Usage tracking
  - Invoice endpoints

## Database & Testing

- [ ] **[DATABASE] Create migrations for EE features**
  - Review existing migrations (page-permissions, audit)
  - Create any additional migrations needed
  - API Keys migration
  - MFA migration
  - SSO migration
  - Feature flag/entitlement migration

- [ ] **[TESTING] Create unit and integration tests**
  - Test suites for each EE module
  - API endpoint tests
  - Service layer tests
  - Database integration tests

- [ ] **[VERIFICATION] Test all EE features end-to-end**
  - Manual testing of all endpoints
  - Integration testing across modules
  - Performance testing

## Waiting On

- [ ] User decision on implementation priority
- [ ] Decision on feature rollout strategy (all at once vs. phased)
- [ ] OIDC callback URL format confirmed: `/api/sso/oidc/callback` (fixed, no UUID)

## Someday

- [ ] Additional reporting features
- [ ] Advanced analytics
- [ ] Custom integrations framework
- [ ] Webhook system

## Done
