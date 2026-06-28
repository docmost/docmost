# Enterprise Edition (EE) Implementation Plan

**Document Version**: 1.0  
**Created**: 2026-06-27  
**Status**: Planning Phase  
**Branch**: `unlock-ee`

---

## Executive Summary

This document provides a comprehensive implementation plan for the Docmost Enterprise Edition (EE) server-side features. Currently, 24 EE features are defined on the client side but lack corresponding server-side implementations. The plan is organized into 6 priority tiers, with detailed requirements, file locations, and implementation steps for each feature.

### Current State
- ✅ **Client**: 24 EE features fully designed with UI components, services, and types
- ❌ **Server**: Empty EE module structure; missing all API endpoints and business logic
- ✅ **Database**: Migrations exist for some features (page-permissions, audit, ai-chat)
- ✅ **License Service**: Stub implementation returns all features enabled in dev mode

### Objectives
1. Implement all 24 EE features on the server side
2. Create comprehensive API endpoints matching client expectations
3. Establish scalable EE module architecture
4. Ensure consistency between client and server APIs
5. Implement proper access control and feature gating

---

## EE Features Overview

### 24 Features Identified

| Category | Features | Count |
|----------|----------|-------|
| **Authentication & Access** | SSO (Custom, Google), MFA, API Keys | 4 |
| **Permissions & Sharing** | Page Permissions, Sharing Controls, Viewer Comments | 3 |
| **Content Management** | Templates, Comment Resolution, Page Verification | 3 |
| **Data & Export** | PDF Export, DOCX Export, Attachment Indexing | 3 |
| **Integrations** | Confluence Import, DOCX Import, PDF Import, SCIM, MCP | 5 |
| **Analytics & Compliance** | Audit Logs, Security Settings, Retention Policies | 3 |
| **AI & Advanced** | AI Chat, AI Search, MCP | 2 |
| **Workspace Features** | Personal Spaces, Bases (Database Tables) | 2 |

---

## Architecture Design

### Module Structure

```
/apps/server/src/ee/
├── ee.module.ts                 # Main EE module, imports all sub-modules
├── ee.controller.ts             # Main EE controller (router prefix)
├── api-key/
│   ├── api-key.module.ts
│   ├── api-key.controller.ts
│   ├── api-key.service.ts
│   └── types/
│       └── api-key.types.ts
├── audit/
│   ├── audit.module.ts
│   ├── audit-query.controller.ts
│   ├── audit-query.service.ts
│   └── types/
│       └── audit.types.ts
├── mfa/
│   ├── mfa.module.ts
│   ├── mfa.controller.ts
│   ├── mfa.service.ts
│   └── types/
│       └── mfa.types.ts
├── page-permission/
│   ├── page-permission.module.ts
│   ├── page-permission.controller.ts
│   ├── page-permission.service.ts
│   └── types/
│       └── page-permission.types.ts
├── ai/
│   ├── ai.module.ts
│   ├── ai-chat.controller.ts
│   ├── ai-chat.service.ts
│   ├── ai-search.service.ts
│   └── types/
│       └── ai.types.ts
├── page-verification/
├── templates/
├── security/
├── scim/
├── sharing-controls/
├── sso/
├── docx-export/
├── pdf-export/
├── confluence-import/
├── attachment-indexing/
├── retention/
├── personal-space/
├── bases/
├── comment/
├── billing/
└── common/
    ├── decorators/
    │   └── require-feature.decorator.ts
    └── guards/
        └── feature-gate.guard.ts
```

### Key Architectural Principles

1. **Feature-based Organization**: Each EE feature has its own folder with module, controller, service
2. **Shared Infrastructure**: Common guards, decorators, and utilities in `/ee/common`
3. **Database Repositories**: Leverage existing DB repos; extend as needed
4. **License Gating**: Use `@RequireFeature()` decorator on controllers
5. **Audit Integration**: All EE operations logged via `AuditService`
6. **Consistent API**: POST-based endpoints with request/response DTOs

---

## Priority 1: Core Infrastructure (Foundation)

### 1.1 EE Module Setup

**Files to Create**:
- `apps/server/src/ee/ee.module.ts`
- `apps/server/src/ee/ee.controller.ts`
- `apps/server/src/ee/common/decorators/require-feature.decorator.ts`
- `apps/server/src/ee/common/guards/feature-gate.guard.ts`

**ee.module.ts**:
```typescript
import { Module } from '@nestjs/common';
import { ApiKeyModule } from './api-key/api-key.module';
import { AuditModule } from './audit/audit.module';
import { MfaModule } from './mfa/mfa.module';
import { PagePermissionModule } from './page-permission/page-permission.module';
import { AiModule } from './ai/ai.module';
// ... import other modules

@Module({
  imports: [
    ApiKeyModule,
    AuditModule,
    MfaModule,
    PagePermissionModule,
    AiModule,
    // ... other modules
  ],
})
export class EeModule {}
```

**@RequireFeature Decorator**:
```typescript
export function RequireFeature(feature: FeatureKey) {
  return applyDecorators(
    UseGuards(FeatureGateGuard),
    SetMetadata('required_feature', feature),
  );
}
```

**Usage**:
```typescript
@Post('/api-keys')
@RequireFeature(Feature.API_KEYS)
getApiKeys() { ... }
```

**Implementation Steps**:
1. Create ee.module.ts with lazy imports
2. Create feature decorator
3. Create feature-gate guard (injects LicenseCheckService)
4. Register EeModule in AppModule (line 88 of app.module.ts)
5. Test that module loads correctly

---

### 1.2 API Key Management

**Client API Contracts** (from `apps/client/src/ee/api-key/services/api-key-service.ts`):

```
POST /api-keys
  Request: { limit, skip, search? }
  Response: { items: IApiKey[], total, hasMore }

POST /api-keys/create
  Request: { name, description?, expiresAt?, scope? }
  Response: IApiKey { id, key, name, created, lastUsed }

POST /api-keys/update
  Request: { apiKeyId, name, description, expiresAt }
  Response: IApiKey

POST /api-keys/revoke
  Request: { apiKeyId }
  Response: void
```

**Database Migration**:
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR NOT NULL,
  description TEXT,
  key_hash VARCHAR UNIQUE NOT NULL,
  scope VARCHAR[] DEFAULT ARRAY['all'],
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  
  CONSTRAINT api_key_unique_per_user UNIQUE(workspace_id, user_id, name)
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_workspace ON api_keys(workspace_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

**Files to Create**:
- `apps/server/src/ee/api-key/api-key.module.ts`
- `apps/server/src/ee/api-key/api-key.controller.ts`
- `apps/server/src/ee/api-key/api-key.service.ts`
- `apps/server/src/database/repos/api-key.repo.ts`
- `apps/server/src/database/migrations/20260627T120000-api-keys.ts` (if migration doesn't exist)

**Implementation Checklist**:
- [ ] Create migration for api_keys table
- [ ] Create ApiKeyRepo extending BaseRepository
- [ ] Create ApiKeyService with CRUD operations
- [ ] Implement hash-based key storage (never store plaintext)
- [ ] Create ApiKeyController with decorators
- [ ] Add @RequireFeature(Feature.API_KEYS) to all endpoints
- [ ] Integrate with AuditService for logging
- [ ] Add response DTOs with proper masking (don't expose full key)
- [ ] Test with Postman/curl

**Key Security Considerations**:
- Hash API keys with bcrypt before storing
- Return full key only once on creation
- Mask key in list responses (show only last 4 chars)
- Validate key format and length
- Implement rate limiting per API key
- Log all API key operations

---

### 1.3 Audit Log Query Endpoints

**Client API Contracts** (from `apps/client/src/ee/audit/services/audit-service.ts`):

```
POST /audit
  Request: { 
    limit, skip, 
    dateFrom?, dateTo?,
    eventType?, resourceType?, userId?,
    sortBy?, sortOrder?
  }
  Response: { items: IAuditLog[], total, hasMore }

POST /audit/retention
  Request: none
  Response: { retentionDays: number }

POST /audit/retention/update
  Request: { auditRetentionDays: number }
  Response: { retentionDays: number }
```

**Database Table** (already exists via migration `20260228T223532-audit.ts`):

```sql
CREATE TABLE audit (
  id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
  workspace_id UUID NOT NULL,
  actor_id UUID,
  actor_type VARCHAR DEFAULT 'user',
  event VARCHAR NOT NULL,
  resource_type VARCHAR NOT NULL,
  resource_id UUID,
  space_id UUID,
  changes JSONB,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Files to Create**:
- `apps/server/src/ee/audit/audit-query.module.ts`
- `apps/server/src/ee/audit/audit-query.controller.ts`
- `apps/server/src/ee/audit/audit-query.service.ts`
- `apps/server/src/database/repos/audit-log.repo.ts`

**Implementation Checklist**:
- [ ] Create AuditLogRepo with complex query builder
- [ ] Implement filtering by date range, event, resource, user
- [ ] Implement sorting and pagination
- [ ] Ensure workspace isolation (cannot query other workspaces)
- [ ] Create AuditQueryService
- [ ] Create AuditQueryController with @RequireFeature(Feature.AUDIT_LOGS)
- [ ] Implement retention update logic
- [ ] Add scheduled job for retention cleanup (delete audit records older than policy)
- [ ] Add test with filtering, sorting, pagination

**Key Features**:
- Full-text search on event names
- Filter by date range with timezone support
- Filter by actor/resource/event type
- Pagination for large datasets
- Order by multiple fields
- Return formatted audit events with readable labels

---

### 1.4 MFA (Multi-Factor Authentication)

**Client API Contracts** (from `apps/client/src/ee/mfa/services/mfa-service.ts`):

```
POST /mfa/status
  Response: { enabled: boolean, lastSet?: string, backupCodesCount: number }

POST /mfa/setup
  Request: { userId }
  Response: { secret: string, qrCode: string }

POST /mfa/enable
  Request: { code: string, secret: string }
  Response: { enabled: true, backupCodes: string[] }

POST /mfa/disable
  Request: { password: string }
  Response: { success: boolean }

POST /mfa/backup-codes
  Request: { userId }
  Response: { backupCodes: string[] }

POST /mfa/verify
  Request: { code: string }
  Response: { success: boolean, token?: string }

POST /mfa/validate-access
  Request: { code: string }
  Response: { valid: boolean }
```

**Database Migration**:
```sql
CREATE TABLE user_mfa (
  id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret_encrypted VARCHAR NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  backup_codes_encrypted VARCHAR[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Files to Create**:
- `apps/server/src/ee/mfa/mfa.module.ts`
- `apps/server/src/ee/mfa/mfa.controller.ts`
- `apps/server/src/ee/mfa/mfa.service.ts`
- `apps/server/src/database/repos/user-mfa.repo.ts`
- `apps/server/src/database/migrations/20260627T130000-user-mfa.ts`

**Implementation Checklist**:
- [ ] Install `speakeasy` (TOTP), `qrcode` libraries
- [ ] Create UserMfaRepo
- [ ] Create MfaService with:
  - [ ] TOTP generation and verification
  - [ ] QR code generation
  - [ ] Backup codes generation
  - [ ] Encryption utilities for secrets
- [ ] Create MfaController with endpoints
- [ ] Add @RequireFeature(Feature.MFA) decorator
- [ ] Integrate with auth flow (post-login MFA check)
- [ ] Add audit logging for enable/disable
- [ ] Test TOTP validation with authenticator apps
- [ ] Test backup codes functionality

**Key Security Considerations**:
- Encrypt secrets at rest using workspace key
- Generate backup codes as one-time use
- Implement rate limiting on verification attempts
- Require password confirmation for disable
- Log all MFA changes
- Enforce MFA policy at workspace level (future)

---

## Priority 2: Feature APIs

### 2.1 Page Permissions

**Client API Contracts** (from `apps/client/src/ee/page-permission/services/page-permission-service.ts`):

```
POST /pages/restrict
  Request: { pageId }
  Response: void

POST /pages/remove-restriction
  Request: { pageId }
  Response: void

POST /pages/add-permission
  Request: { pageId, userId | groupId, role: 'viewer'|'editor'|'admin' }
  Response: void

POST /pages/remove-permission
  Request: { pageId, userId | groupId }
  Response: void

POST /pages/update-permission
  Request: { pageId, userId | groupId, role }
  Response: void

POST /pages/permission-members
  Request: { pageId, limit, skip, search? }
  Response: { items: IMember[], total }

POST /pages/permission-info
  Request: { pageId }
  Response: { restricted: boolean, accessLevel: string, members: [] }
```

**Database Tables** (already exist via migration `20260224T233803-page-permissions.ts`):

```sql
CREATE TABLE page_access (
  id UUID PRIMARY KEY,
  page_id UUID UNIQUE NOT NULL REFERENCES pages(id),
  workspace_id UUID NOT NULL,
  space_id UUID NOT NULL,
  access_level VARCHAR NOT NULL,
  creator_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE page_permissions (
  id UUID PRIMARY KEY,
  page_access_id UUID NOT NULL REFERENCES page_access(id),
  user_id UUID | NULL,
  group_id UUID | NULL,
  role VARCHAR NOT NULL,
  added_by_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Files to Create**:
- `apps/server/src/ee/page-permission/page-permission.module.ts`
- `apps/server/src/ee/page-permission/page-permission.controller.ts`
- `apps/server/src/ee/page-permission/page-permission.service.ts`
- `apps/server/src/database/repos/page-access.repo.ts` (extend existing)
- `apps/server/src/database/repos/page-permission.repo.ts` (extend existing)

**Implementation Checklist**:
- [ ] Review existing PageAccessRepo and PagePermissionRepo
- [ ] Create PagePermissionService with:
  - [ ] Restriction management (enable/disable)
  - [ ] Permission CRUD (add/remove/update)
  - [ ] Member listing with search/pagination
  - [ ] Permission info retrieval
  - [ ] Cascade deletion on space delete
- [ ] Create PagePermissionController
- [ ] Add @RequireFeature(Feature.PAGE_PERMISSIONS)
- [ ] Add audit logging for all changes
- [ ] Validate user has space-level admin permission
- [ ] Handle group permissions expansion
- [ ] Test permission inheritance
- [ ] Test concurrent updates

**Key Business Logic**:
- Only space admins can manage page permissions
- Restriction disables inherited space permissions
- Roles: viewer (read-only), editor (read+write), admin (full control)
- Group permissions apply to all members
- Page creator gets implicit ownership

---

### 2.2 AI Chat Endpoints

**Client API Contracts** (from `apps/client/src/ee/ai-chat/services/ai-chat-service.ts`):

```
POST /ai/chats/create
  Response: { chatId: UUID }

POST /ai/chats
  Request: { limit, skip, search?, sortBy?, dateFrom?, dateTo? }
  Response: { items: IChat[], total, hasMore }

POST /ai/chats/info
  Request: { chatId }
  Response: { chatId, title, createdAt, updatedAt, messageCount }

POST /ai/chats/delete
  Request: { chatId }
  Response: void

POST /ai/chats/update
  Request: { chatId, title }
  Response: void

POST /ai/chats/search
  Request: { query, limit, skip }
  Response: { items: ISearchResult[], total }

POST /ai/chats/upload
  Request: FormData { files: File[] }
  Response: { uploadedFiles: [] }

POST /ai/generate
  Request: { prompt, context?, model? }
  Response: { content: string, usage: { tokens } }
```

**Database Migration** (already exists via `20260409T132415-ai-chat.ts`):

```sql
CREATE TABLE ai_chats (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title VARCHAR,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE ai_messages (
  id UUID PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES ai_chats(id),
  role VARCHAR NOT NULL, -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ
);
```

**Files to Create**:
- `apps/server/src/ee/ai/ai.module.ts`
- `apps/server/src/ee/ai/ai-chat.controller.ts`
- `apps/server/src/ee/ai/ai-chat.service.ts`
- `apps/server/src/ee/ai/ai-search.service.ts`
- `apps/server/src/database/repos/ai-chat.repo.ts`
- `apps/server/src/database/repos/ai-message.repo.ts`
- `apps/server/src/integrations/ai/ai-provider.service.ts` (Claude/OpenAI)

**Implementation Checklist**:
- [ ] Design AI provider abstraction
- [ ] Implement Claude integration (or OpenAI based on selection)
- [ ] Create AiChatRepo with list/search/filter
- [ ] Create AiMessageRepo
- [ ] Create AiChatService with CRUD
- [ ] Create AiSearchService for content search
- [ ] Create AiChatController with @RequireFeature(Feature.AI)
- [ ] Implement streaming response support (SSE or WebSocket)
- [ ] Add rate limiting per user
- [ ] Add token usage tracking for billing
- [ ] Handle file uploads with virus scanning
- [ ] Add prompt injection validation
- [ ] Test with various prompts
- [ ] Implement caching for common queries

**Key Decisions Needed**:
- Which AI provider? (Claude API recommended)
- Model selection (Claude 3.5 Sonnet recommended)
- Streaming vs. non-streaming responses?
- Max tokens and rate limits per user?
- Should conversations be persisted in context window?

---

### 2.3 Page Verification

**Purpose**: Allow workspace admins to sign/verify page content integrity

**Client API Contracts** (estimated from `apps/client/src/ee/page-verification`):

```
POST /pages/verify/sign
  Request: { pageId }
  Response: { signature: string, signedAt: string }

POST /pages/verify/status
  Request: { pageId }
  Response: { verified: boolean, signature?: string, signedBy?: User, signedAt?: string }

POST /pages/verify/validate
  Request: { pageId, expectedHash?: string }
  Response: { valid: boolean, changes?: [] }
```

**Database Migration**:
```sql
CREATE TABLE page_verifications (
  id UUID PRIMARY KEY,
  page_id UUID UNIQUE NOT NULL REFERENCES pages(id),
  workspace_id UUID NOT NULL,
  signature_hash VARCHAR UNIQUE NOT NULL,
  content_hash VARCHAR,
  signed_by_id UUID,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
```

**Implementation Checklist**:
- [ ] Create PageVerificationService
- [ ] Implement cryptographic signing (Ed25519)
- [ ] Create verification/validation logic
- [ ] Create controller endpoints
- [ ] Add audit logging
- [ ] Test signature validation

---

## Priority 3-6: Remaining Features

Due to length constraints, the remaining features (Templates, Security Settings, SCIM, Sharing Controls, SSO, Exports, Imports, Retention, Personal Spaces, Bases, Comments, Billing) follow the same pattern:

### Pattern for Each Feature

1. **Client API Contracts**: Extract from client service files
2. **Database Design**: Create migrations if needed
3. **Repository Layer**: Create/extend repos
4. **Service Layer**: Implement business logic
5. **Controller Layer**: Create REST endpoints
6. **Feature Gating**: Add @RequireFeature decorator
7. **Audit Integration**: Log all operations
8. **Testing**: Unit + integration tests
9. **Security**: Validate access control

---

## API Endpoint Summary

### Core Endpoints (All under `/api` prefix in production)

```
Authentication & Access Control
├── POST /auth/login (with MFA check)
├── POST /mfa/status
├── POST /mfa/setup
├── POST /mfa/enable
├── POST /mfa/disable
├── POST /mfa/verify
└── POST /mfa/backup-codes

API Keys Management
├── POST /api-keys
├── POST /api-keys/create
├── POST /api-keys/update
└── POST /api-keys/revoke

Audit Logs
├── POST /audit
├── POST /audit/retention
└── POST /audit/retention/update

Page Permissions
├── POST /pages/restrict
├── POST /pages/remove-restriction
├── POST /pages/add-permission
├── POST /pages/remove-permission
├── POST /pages/update-permission
├── POST /pages/permission-members
└── POST /pages/permission-info

AI Features
├── POST /ai/generate
├── POST /ai/chats/create
├── POST /ai/chats
├── POST /ai/chats/info
├── POST /ai/chats/delete
├── POST /ai/chats/update
├── POST /ai/chats/search
└── POST /ai/chats/upload

... (other features follow similar patterns)
```

---

## Implementation Timeline

### Phase 1: Foundation (Week 1)
- [ ] EE module setup
- [ ] Feature decorator & guard
- [ ] API Keys (complete)
- [ ] Audit Logs (complete)

### Phase 2: Core Auth & Features (Week 2)
- [ ] MFA implementation
- [ ] Page Permissions
- [ ] AI Chat setup

### Phase 3: Remaining Features (Weeks 3-4)
- [ ] Templates, Security, SCIM
- [ ] Exports, Imports
- [ ] Retention, Billing

### Phase 4: Testing & Polish (Week 5)
- [ ] Comprehensive testing
- [ ] Documentation
- [ ] Performance optimization
- [ ] Security audit

---

## Testing Strategy

### Unit Tests
- Service layer logic
- DTO validation
- Error handling

### Integration Tests
- API endpoint contracts
- Database operations
- Permission validation

### End-to-End Tests
- Full feature workflows
- Multi-feature interactions
- Edge cases and error scenarios

---

## Deployment Checklist

- [ ] All migrations run successfully
- [ ] Feature flag checks working
- [ ] Audit logging configured
- [ ] Rate limiting configured
- [ ] API documentation generated
- [ ] Backward compatibility verified
- [ ] Performance baseline established
- [ ] Security review completed

---

## References

- **Client EE Modules**: `/apps/client/src/ee/`
- **Server App Module**: `/apps/server/src/app.module.ts` (line 31-43)
- **License Service**: `/apps/server/src/integrations/environment/license-check.service.ts`
- **Feature Enum**: `/apps/server/src/common/features.ts`
- **Database Repos**: `/apps/server/src/database/repos/`
- **Migrations**: `/apps/server/src/database/migrations/`

---

## Execution Guidelines for Team/AI

### For Each Feature:

1. **Analysis Phase**
   - Review client service file for API contracts
   - Check for existing database tables
   - Identify dependencies on other modules

2. **Design Phase**
   - Create database migration if needed
   - Design service layer architecture
   - Plan controller routes

3. **Implementation Phase**
   - Create module structure
   - Implement repository layer
   - Implement service layer
   - Create controller endpoints
   - Add @RequireFeature decorator
   - Integrate audit logging

4. **Testing Phase**
   - Write unit tests for service
   - Write integration tests for API
   - Test with real client
   - Verify audit logs

5. **Review Phase**
   - Security validation
   - Performance check
   - Documentation review

### For AI Execution

Start with Priority 1 features. For each:

```bash
# 1. Read client service to understand API contract
cat apps/client/src/ee/[feature]/services/[feature]-service.ts

# 2. Check database schema
find apps/server/src/database/migrations -name "*[feature]*"

# 3. Create module structure
mkdir -p apps/server/src/ee/[feature]

# 4. Implement in order: repo → service → controller

# 5. Test endpoints
curl -X POST http://localhost:3000/api/[endpoint]
```

---

## Questions & Decisions

**TODO: Clarify with team before implementation**

1. **AI Provider Selection**
   - [ ] Claude API (recommended)
   - [ ] OpenAI GPT
   - [ ] Local LLM
   - [ ] Other?

2. **Feature Rollout Strategy**
   - [ ] All features at once
   - [ ] Phased by priority
   - [ ] User opt-in beta
   - [ ] Feature flags per workspace?

3. **Billing Integration**
   - [ ] Integration with existing billing system?
   - [ ] New billing module needed?
   - [ ] Usage tracking granularity?

4. **Compliance Requirements**
   - [ ] GDPR compliance for audit logs?
   - [ ] Data residency requirements?
   - [ ] SOC 2 / ISO 27001 certification needed?

---

**End of Implementation Plan**
