# EE Current State Analysis

**Date**: 2026-06-27  
**Analyzer**: Claude Code  
**Branch**: unlock-ee  

---

## Executive Summary

The Docmost project has **24 Enterprise Edition features** fully designed on the client side but **completely missing server-side implementations**. The infrastructure is partially in place (stub services, database migrations, license checking), but **zero API endpoints** for EE features exist.

**Effort Estimate**: 4-6 weeks for comprehensive implementation  
**Complexity**: Medium (well-defined API contracts, clear patterns)  
**Risk Level**: Low (isolated in EE module, doesn't affect core features)

---

## What Exists ✅

### Client-Side (Complete)
- ✅ 24 EE feature modules with full UI/components
- ✅ Service layer with API contracts (defines endpoint expectations)
- ✅ Type definitions for all EE DTOs
- ✅ Feature-gated UI components using `useFeature()` hook
- ✅ Example: `/apps/client/src/ee/api-key/` (100% complete)
  - Components: api-key-table, create-modal, revoke-modal, etc.
  - Services: getApiKeys(), createApiKey(), updateApiKey(), revokeApiKey()
  - Types: IApiKey, ICreateApiKeyRequest, IUpdateApiKeyRequest
  - Pages: user-api-keys.tsx, workspace-api-keys.tsx

### Server-Side Foundation (Partial)
- ✅ License check service: `/apps/server/src/integrations/environment/license-check.service.ts`
  - Currently: Returns all features enabled in dev mode
  - Note: Returns `true` for everything (mock implementation)

- ✅ Feature enum defined: `/apps/server/src/common/features.ts`
  ```typescript
  SSO_CUSTOM, SSO_GOOGLE, MFA, API_KEYS, COMMENT_RESOLUTION,
  PAGE_PERMISSIONS, AI, CONFLUENCE_IMPORT, DOCX_IMPORT, PDF_IMPORT,
  ATTACHMENT_INDEXING, SECURITY_SETTINGS, MCP, SCIM,
  PAGE_VERIFICATION, AUDIT_LOGS, RETENTION, SHARING_CONTROLS,
  TEMPLATES, VIEWER_COMMENTS, PERSONAL_SPACES, DOCX_EXPORT, BASES
  ```

- ✅ Audit service infrastructure:
  - Base audit service: `/apps/server/src/integrations/audit/audit.service.ts`
  - Audit table schema: Migration `20260228T223532-audit.ts`
  - Audit events are being logged (integration in page.controller.ts)
  - But NO query endpoints exist for retrieving audit logs

- ✅ EE module placeholder:
  - Directory exists: `/apps/server/src/ee/` (empty)
  - Module loading attempted in app.module.ts (lines 31-43)
  - Currently wrapped in try-catch that silently fails
  - Will exit if `CLOUD=true` (cloud deployment requires EE)

- ✅ Database migrations for some features:
  - `20260224T233803-page-permissions.ts` - page_access, page_permissions tables
  - `20260228T223532-audit.ts` - audit table
  - `20260409T132415-ai-chat.ts` - ai_chats, ai_messages tables

### Existing Server Patterns
- ✅ Controller-service-repo pattern established
- ✅ Audit integration pattern (see page.controller.ts)
- ✅ Error handling and validation patterns
- ✅ Database repository pattern (Kysely)
- ✅ DTO and type system
- ✅ Authorization/permission checking (space-level, user-level)

---

## What's Missing ❌

### Total Missing: 24 API Features (67+ endpoints)

#### Category 1: Authentication & Access (4 features, ~15 endpoints)

**API_KEYS** ❌
- Missing Files: 6 files + 1 migration
- Missing Endpoints:
  - `POST /api-keys` - List API keys
  - `POST /api-keys/create` - Create key
  - `POST /api-keys/update` - Update key
  - `POST /api-keys/revoke` - Revoke key
- Missing DB:
  - api_keys table (migration needed)
  - api_keys repository
- Missing Logic:
  - Key generation and hashing
  - Expiration handling
  - Scope validation

**MFA** ❌
- Missing Files: 7 files + 1 migration
- Missing Endpoints:
  - `POST /mfa/status` - Get MFA status
  - `POST /mfa/setup` - Generate TOTP secret & QR
  - `POST /mfa/enable` - Enable MFA
  - `POST /mfa/disable` - Disable MFA
  - `POST /mfa/verify` - Verify TOTP code
  - `POST /mfa/backup-codes` - Generate backup codes
  - `POST /mfa/validate-access` - Validate for sensitive ops
- Missing DB:
  - user_mfa table
  - user_mfa repository
- Missing Logic:
  - TOTP implementation
  - Backup code generation
  - Secret encryption

**SSO_CUSTOM** ❌
- Missing Files: 8+ files
- Missing Endpoints:
  - `/auth/sso/configure` - Configure custom provider
  - `/auth/sso/login` - Login via custom provider
  - `/auth/sso/callback` - OIDC/SAML callback
  - `/auth/sso/validate` - Validate SSO config
- Missing Logic:
  - OIDC/SAML protocol implementation
  - Provider configuration storage
  - User sync and auto-provisioning

**SSO_GOOGLE** ❌
- Similar to custom SSO but Google-specific

#### Category 2: Permissions & Sharing (3 features, ~12 endpoints)

**PAGE_PERMISSIONS** ❌
- Missing Files: 5 files (DB exists, repos need work)
- Missing Endpoints:
  - `POST /pages/restrict` - Restrict page access
  - `POST /pages/remove-restriction` - Remove restriction
  - `POST /pages/add-permission` - Grant permission
  - `POST /pages/remove-permission` - Revoke permission
  - `POST /pages/update-permission` - Update role
  - `POST /pages/permission-members` - List members
  - `POST /pages/permission-info` - Get restriction info
- Missing Logic:
  - Permission model enforcement
  - Role-based access control
  - Group permission expansion
  - Inheritance rules

**SHARING_CONTROLS** ❌
**VIEWER_COMMENTS** ❌

#### Category 3: Compliance & Admin (3 features, ~8 endpoints)

**AUDIT_LOGS** ⚠️ (Partial)
- DB exists ✅, Table being written to ✅
- Missing: Query/retrieval endpoints
- Missing Files: 3 files
- Missing Endpoints:
  - `POST /audit` - Query audit logs
  - `POST /audit/retention` - Get retention policy
  - `POST /audit/retention/update` - Update retention
- Missing Logic:
  - Advanced filtering (date, event, resource, user)
  - Pagination and sorting
  - Retention cleanup job

**SECURITY_SETTINGS** ❌
**RETENTION** ⚠️ (Partial)
- DB column exists: `audit_retention_days`, `trash_retention_days`
- Missing: Enforcement and cleanup logic

#### Category 4: Content Management (5 features, ~12 endpoints)

**TEMPLATES** ❌
**PAGE_VERIFICATION** ❌
**COMMENT_RESOLUTION** ❌
**PDF_EXPORT** ❌
**DOCX_EXPORT** ❌

#### Category 5: AI & Integrations (6 features, ~15 endpoints)

**AI** ❌
- Partial DB exists (ai_chats, ai_messages migrations)
- Missing: Complete service and endpoints
- Missing Endpoints:
  - `POST /ai/generate` - Generate content
  - `POST /ai/chats/create` - Create chat
  - `POST /ai/chats` - List chats
  - `POST /ai/chats/info` - Get chat details
  - `POST /ai/chats/delete` - Delete chat
  - `POST /ai/chats/update` - Update chat
  - `POST /ai/chats/search` - Search chat content
  - `POST /ai/chats/upload` - Upload files
- Missing Logic:
  - LLM provider integration (Claude/OpenAI)
  - Streaming responses
  - Token tracking for billing
  - File processing

**MCP** ❌ (Claude Protocol support)
**SCIM** ❌ (User provisioning)
**CONFLUENCE_IMPORT** ❌
**DOCX_IMPORT** ❌
**PDF_IMPORT** ❌
**ATTACHMENT_INDEXING** ❌

#### Category 6: Workspace Features (2 features, ~8 endpoints)

**PERSONAL_SPACES** ❌
**BASES** ❌ (Database/table views)

#### Category 7: Cloud/Billing (1 feature, ~5 endpoints)

**BILLING** ❌

---

## Code Location Reference

### Client EE Features (Reference for API Contracts)

```
/apps/client/src/ee/
├── ai/                          → AI search & generation
├── ai-chat/                     → Chat conversations
├── api-key/                     → API key management
├── audit/                       → Audit log viewer
├── base/                        → Database/table views
├── billing/                     → Billing/subscription
├── cloud/                       → Cloud-specific features
├── comment/                     → Advanced comments
├── components/                  → Shared EE components
├── entitlement/                 → License/entitlement checking
├── licence/                     → License types
├── mfa/                         → Multi-factor authentication
├── page-permission/             → Page-level access control
├── page-verification/           → Page signing/verification
├── pdf-export/                  → PDF export
├── personal-space/              → Personal workspaces
├── scim/                        → User provisioning
├── security/                    → Security settings
├── template/                    → Page templates
└── utils.ts                     → Shared utilities
```

### Server Current State

```
/apps/server/src/
├── app.module.ts                → ✅ Tries to import EeModule (line 88)
├── common/
│   └── features.ts              → ✅ Feature enum (24 features)
├── integrations/
│   └── audit/                   → ⚠️ Write-only, no query endpoints
├── database/
│   ├── migrations/
│   │   ├── 20260224T233803-page-permissions.ts  → ✅
│   │   ├── 20260228T223532-audit.ts             → ✅
│   │   └── 20260409T132415-ai-chat.ts           → ✅
│   └── repos/
│       └── page/
│           ├── page-access.repo.ts              → ⚠️ Exists but minimal
│           └── page-permission.repo.ts          → ⚠️ Exists but minimal
├── ee/                          → ❌ Empty directory
└── ... core modules (authentication, pages, spaces, etc.)
```

---

## Effort Breakdown

### By Feature (Estimated Hours)

| Feature | Priority | Complexity | Est. Hours | Files | Notes |
|---------|----------|-----------|-----------|-------|-------|
| API Keys | 1 | Low | 8 | 6+1 | Straightforward CRUD |
| Audit Logs | 1 | Medium | 10 | 5 | Query complexity + cleanup job |
| MFA | 1 | Medium | 12 | 7+1 | TOTP + backup codes + integration |
| Page Permissions | 2 | High | 16 | 5 | Complex permission logic |
| AI Chat | 2 | High | 20 | 8 | LLM integration + streaming |
| Page Verification | 2 | Medium | 10 | 4 | Cryptographic signing |
| Templates | 3 | Medium | 10 | 5 | Content versioning |
| Security Settings | 3 | Low | 8 | 4 | Configuration endpoints |
| SCIM | 3 | High | 16 | 6 | Full SCIM 2.0 protocol |
| Sharing Controls | 3 | Medium | 10 | 5 | Link sharing policies |
| SSO Custom | 3 | High | 20 | 8 | OIDC/SAML protocols |
| SSO Google | 3 | Medium | 12 | 5 | OAuth2 + Google SDK |
| DOCX Export | 4 | Medium | 10 | 4 | Leverage existing export |
| PDF Export | 4 | Medium | 10 | 4 | Leverage existing export |
| Confluence Import | 4 | Medium | 10 | 4 | API integration |
| DOCX Import | 4 | Low | 6 | 3 | Leverage existing import |
| PDF Import | 4 | Low | 6 | 3 | Leverage existing import |
| Attachment Indexing | 4 | High | 14 | 5 | Search integration |
| Data Retention | 4 | Medium | 10 | 4 | Cleanup jobs + policies |
| Personal Spaces | 5 | Medium | 12 | 5 | User-specific workspaces |
| Bases (Tables) | 5 | High | 24 | 10 | Complex data model |
| Comment Resolution | 5 | Low | 8 | 4 | Status management |
| Viewer Comments | 5 | Low | 6 | 3 | Read-only comments |
| Billing | 6 | Medium | 14 | 6 | Payment integration |
| MCP (Claude Protocol) | 2 | High | 16 | 6 | Protocol implementation |
| **TOTAL** | - | - | **318 hours** | **~160 files** | ~6-8 weeks, 1 dev |

### By Priority Tier

| Tier | Features | Hours | Weeks | Files |
|------|----------|-------|-------|-------|
| Foundation | EE Module, Guards, Decorators | 6 | 0.15 | 3 |
| Priority 1 | API Keys, Audit, MFA | 30 | 0.75 | 18 |
| Priority 2 | Page Perms, AI Chat, Page Verify, MCP | 62 | 1.55 | 27 |
| Priority 3 | Templates, Security, SCIM, Sharing, SSO | 76 | 1.90 | 32 |
| Priority 4 | Exports, Imports, Attachments, Retention | 56 | 1.40 | 24 |
| Priority 5 | Personal Spaces, Bases, Comments | 50 | 1.25 | 22 |
| Priority 6 | Billing | 14 | 0.35 | 6 |

---

## Key Decisions Needed

### 1. AI Provider Selection ⚠️
**Decision Required**: Which LLM provider for AI Chat and generation?
- [ ] **Claude API** (Recommended - best quality)
  - Model: claude-3.5-sonnet
  - Pricing: Per-token
  - Streaming: Supported
  - Integration: Well-documented
  
- [ ] **OpenAI GPT**
  - Model: gpt-4 or gpt-4-turbo
  - Pricing: Per-token (expensive)
  - Streaming: Supported
  - Integration: Well-documented
  
- [ ] **Local LLM** (Ollama, etc.)
  - No external costs
  - Limited capability
  - Infrastructure required

- [ ] **Not Implementing AI for Now**
  - Delay 2+ weeks
  - Focus on other features first

**Impact**: AI Chat (20 hours) blocks MCP integration

### 2. Feature Rollout Strategy ⚠️
**Decision Required**: How to release EE features?
- [ ] **All at Once**
  - Pro: Simpler, comprehensive feature set
  - Con: Complex testing, high risk

- [ ] **Phased by Priority** (Recommended)
  - Week 1-2: Priority 1 (P1)
  - Week 3-4: Priority 2 (P2)
  - Week 5+: Priority 3+ (P3+)
  - Pro: Incremental testing, gradual rollout
  - Con: Multiple releases, more testing

- [ ] **Feature Flags Per Workspace**
  - Pro: A/B testing, gradual rollout
  - Con: Complex licensing system needed

- [ ] **Beta Program**
  - Pro: Real-world testing
  - Con: Requires customer communication

**Impact**: Testing strategy, deployment planning

### 3. Database Performance ⚠️
**Decision Required**: How to handle large datasets?
- [ ] **Simple**: Load all records, filter in application
- [ ] **Optimized**: Database-level filtering, indexing
- [ ] **Advanced**: Caching layer (Redis), search engine (ElasticSearch)

**Impact**: Audit logs (could have millions of records), AI chat content

### 4. Billing Integration ⚠️
**Decision Required**: How to handle feature licensing?
- [ ] **Per-Feature**: Each feature is a line item
- [ ] **Tiers**: Gold/Platinum plans with feature bundles
- [ ] **Usage-Based**: Charge for feature usage (tokens, API calls)
- [ ] **Not Implementing**: Features free in EE

**Impact**: Billing service (14 hours), accounting integration

---

## Risk Assessment

### Technical Risks 🟡 (Medium)

| Risk | Impact | Mitigation |
|------|--------|-----------|
| API contract mismatch | Client fails | Test with real client during dev |
| Permission bypass | Security issue | Security review + penetration test |
| MFA bypass in tests | Production issue | Test with real MFA apps |
| AI prompt injection | Data leak | Validate + sanitize prompts |
| Large audit log queries | Performance issue | Add indexing + pagination |
| Concurrent permission changes | Data corruption | Use transactions + optimistic locking |

### Schedule Risks 🟠 (Medium-High)

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Scope creep | +2-3 weeks | Strict prioritization, no new features |
| AI provider selection delay | +1 week | Decide now, use Claude API |
| Database performance issues | +1-2 weeks | Load testing early, optimize queries |
| Unexpected client issues | +2-3 weeks | Continuous integration testing |

### Compliance Risks 🔴 (High)

| Risk | Impact | Mitigation |
|------|--------|-----------|
| GDPR audit log storage | Legal exposure | Implement DPIA, retention policies |
| SOC 2 gaps | Certification blocked | Audit logging + access control |
| PII in audit logs | Data breach | Mask sensitive data in logs |

---

## Success Criteria

### Phase 1 (Priority 1) ✅
- [ ] All 3 P1 features implemented (API Keys, Audit, MFA)
- [ ] All endpoints tested with client
- [ ] Feature gating working (enabled/disabled)
- [ ] Audit logging verified
- [ ] 90%+ test coverage
- [ ] Performance baseline acceptable (<100ms)

### Phase 2 (Priority 2) ✅
- [ ] All 4 P2 features implemented (Permissions, AI, Verify, MCP)
- [ ] End-to-end workflows working
- [ ] Permission inheritance validated
- [ ] AI chat streaming working
- [ ] No regressions in core features

### Final (All Features) ✅
- [ ] All 24 features implemented
- [ ] API documentation complete
- [ ] User guide documentation
- [ ] Zero critical/high security issues
- [ ] Performance within SLOs
- [ ] Ready for production deployment

---

## Recommendations

### ✅ Do First (High Priority)
1. **Create EE module structure** (Foundation)
2. **Implement P1 features** (API Keys, Audit, MFA) - these are lowest risk
3. **Decide on AI provider** - blocks P2 work
4. **Set up CI/CD for EE testing** - catch regressions early
5. **Start with phased rollout** - allows incremental testing

### ⚠️ Do Later (Lower Priority)
1. Advanced features (SCIM, SSO, Confluence integration)
2. Billing integration
3. Performance optimization
4. Advanced reporting

### ❌ Don't Do Now
1. Refactor core features
2. Add new features to base product
3. Optimize infrastructure
4. Implement deprecation warnings

---

## Next Steps for Implementation

### Step 1: Team Alignment (Day 1)
- [ ] Review this document with team
- [ ] Make decisions on AI provider, rollout strategy
- [ ] Assign developer(s) to EE implementation
- [ ] Schedule weekly sync meetings

### Step 2: Foundation Work (Days 1-2)
- [ ] Create EE module structure
- [ ] Create @RequireFeature decorator and guard
- [ ] Set up testing framework
- [ ] Create base service/controller classes

### Step 3: Priority 1 Implementation (Days 3-7)
- [ ] API Keys (Days 3-4)
- [ ] Audit Logs (Days 5)
- [ ] MFA (Days 6-7)
- [ ] Integration testing with client

### Step 4: Review & Feedback (Days 8-9)
- [ ] Security review
- [ ] Performance testing
- [ ] Client testing
- [ ] Fixes and refinements

### Step 5: Priority 2 (Days 10-21)
- [ ] Page Permissions
- [ ] AI Chat (if AI provider decided)
- [ ] Page Verification
- [ ] MCP (Claude Protocol)

---

## Appendix: File Statistics

### Client EE Implementation
- **Total Files**: 200+
- **Components**: 80+
- **Services**: 25+
- **Types**: 50+
- **Lines of Code**: ~15,000

### Server EE Implementation (Needed)
- **Modules**: 24
- **Controllers**: 24+
- **Services**: 24+
- **Repositories**: 15+
- **DTOs**: 40+
- **Migrations**: 10+
- **Tests**: 100+ test files
- **Estimated Total**: ~160 files, ~20,000 lines of code

---

**Document Generated**: 2026-06-27  
**Analysis Confidence**: High (based on code inspection)  
**Last Updated**: 2026-06-27
