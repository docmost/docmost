# EE Implementation - Quick Reference

## Current Status

**Last Updated**: 2026-06-27  
**Client Features**: ✅ 24 features (fully designed)  
**Server Features**: ❌ 0 endpoints (to be implemented)  
**Database Schema**: ✅ Partial (migrations exist for audit, page-permissions, ai-chat)

---

## 24 EE Features by Category

| # | Feature | Priority | Category | API Prefix | Status |
|---|---------|----------|----------|-----------|--------|
| 1 | API Keys | P1 | Auth | `/api-keys` | TODO |
| 2 | Audit Logs | P1 | Compliance | `/audit` | TODO |
| 3 | MFA | P1 | Auth | `/mfa` | TODO |
| 4 | Page Permissions | P2 | Access | `/pages/*` | TODO |
| 5 | AI Chat | P2 | AI | `/ai/chats` | TODO |
| 6 | Page Verification | P2 | Content | `/pages/verify` | TODO |
| 7 | Templates | P3 | Content | `/templates` | TODO |
| 8 | Security Settings | P3 | Admin | `/security` | TODO |
| 9 | SCIM | P3 | Integration | `/scim` | TODO |
| 10 | Sharing Controls | P3 | Access | `/sharing` | TODO |
| 11 | SSO Custom | P3 | Auth | `/auth/sso` | TODO |
| 12 | SSO Google | P3 | Auth | `/auth/google` | TODO |
| 13 | DOCX Export | P4 | Export | `/export/docx` | TODO |
| 14 | PDF Export | P4 | Export | `/export/pdf` | TODO |
| 15 | Confluence Import | P4 | Import | `/import/confluence` | TODO |
| 16 | DOCX Import | P4 | Import | `/import/docx` | TODO |
| 17 | PDF Import | P4 | Import | `/import/pdf` | TODO |
| 18 | Attachment Indexing | P4 | Search | `/attachments/index` | TODO |
| 19 | Data Retention | P4 | Compliance | `/retention` | TODO |
| 20 | Personal Spaces | P5 | Workspace | `/spaces/personal` | TODO |
| 21 | Bases (Tables) | P5 | Content | `/bases` | TODO |
| 22 | Comment Resolution | P5 | Comments | `/comments/*` | TODO |
| 23 | Viewer Comments | P5 | Comments | `/comments/*` | TODO |
| 24 | Billing | P6 | Cloud | `/billing` | TODO |
| 25 | MCP | P2 | Integration | `/mcp` | TODO |

---

## Step 0: Create EE Module (Foundation)

```bash
mkdir -p apps/server/src/ee/{api-key,audit,mfa,page-permission,ai,common/{decorators,guards}}
touch apps/server/src/ee/ee.module.ts
touch apps/server/src/ee/ee.controller.ts
```

### ee.module.ts
```typescript
import { Module } from '@nestjs/common';
import { ApiKeyModule } from './api-key/api-key.module';
import { AuditModule } from './audit/audit.module';
import { MfaModule } from './mfa/mfa.module';
// ... import all sub-modules

@Module({
  imports: [
    ApiKeyModule,
    AuditModule,
    MfaModule,
    // ... other modules
  ],
})
export class EeModule {}
```

### In app.module.ts (line 88)
```typescript
// Replace: ...enterpriseModules,
// With:
EeModule,
```

---

## Step 1: API Keys

**Files**: 6 files + 1 migration

### 1.1 Migration: Create api_keys table
- File: `apps/server/src/database/migrations/20260627T120000-api-keys.ts`
- Schema: id, workspace_id, user_id, name, key_hash, scope, expires_at, created_at, updated_at, revoked_at

### 1.2 Repository
- File: `apps/server/src/database/repos/api-key.repo.ts`
- Methods: create(), findById(), list(), updateById(), revokeById()

### 1.3 Module
- File: `apps/server/src/ee/api-key/api-key.module.ts`

### 1.4 Service
- File: `apps/server/src/ee/api-key/api-key.service.ts`
- Methods: getApiKeys(), createApiKey(), updateApiKey(), revokeApiKey()
- Security: Hash keys with bcrypt, mask in responses

### 1.5 Controller
- File: `apps/server/src/ee/api-key/api-key.controller.ts`
- Routes:
  - `POST /api-keys` → list (paginated)
  - `POST /api-keys/create` → create
  - `POST /api-keys/update` → update
  - `POST /api-keys/revoke` → revoke

### 1.6 DTOs & Types
- File: `apps/server/src/ee/api-key/types/api-key.types.ts`

**Test**:
```bash
curl -X POST http://localhost:3000/api/api-keys/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-key","description":"test"}'
```

---

## Step 2: Audit Logs

**Files**: 5 files (migration already exists)

### 2.1 Repository
- File: `apps/server/src/database/repos/audit-log.repo.ts`
- Use existing `audit` table from `20260228T223532-audit.ts`
- Methods: list(), filter(), search(), delete()

### 2.2 Module
- File: `apps/server/src/ee/audit/audit-query.module.ts`

### 2.3 Service
- File: `apps/server/src/ee/audit/audit-query.service.ts`
- Methods: getAuditLogs(), getRetention(), updateRetention()
- Add retention cleanup job (delete records older than policy)

### 2.4 Controller
- File: `apps/server/src/ee/audit/audit-query.controller.ts`
- Routes:
  - `POST /audit` → list with filters
  - `POST /audit/retention` → get policy
  - `POST /audit/retention/update` → update policy

**Note**: Audit *writing* already happens in BaseAuditService. This is for *reading*.

---

## Step 3: MFA

**Files**: 7 files + 1 migration

### 3.1 Migration
- File: `apps/server/src/database/migrations/20260627T130000-user-mfa.ts`
- Schema: id, user_id, secret_encrypted, enabled, backup_codes_encrypted, created_at, updated_at

### 3.2 Repository
- File: `apps/server/src/database/repos/user-mfa.repo.ts`

### 3.3 Module
- File: `apps/server/src/ee/mfa/mfa.module.ts`
- Install: `npm install speakeasy qrcode`

### 3.4 Service
- File: `apps/server/src/ee/mfa/mfa.service.ts`
- Methods:
  - getStatus()
  - setup() → returns secret + QR code
  - enable() → verify code, save secret encrypted
  - disable() → require password
  - verifyCode() → check TOTP
  - generateBackupCodes() → create 10 one-time codes

### 3.5 Controller
- Routes: /mfa/status, /mfa/setup, /mfa/enable, /mfa/disable, /mfa/verify, /mfa/backup-codes

**Security**:
- Encrypt secrets with workspace encryption key
- Store backup codes as hashed values
- Rate limit verification to 3 attempts/minute

---

## Step 4: Page Permissions

**Files**: 5 files (database migrations already exist)

### 4.1 Repository
- Files: Extend `apps/server/src/database/repos/page/page-access.repo.ts`
       and `apps/server/src/database/repos/page/page-permission.repo.ts`

### 4.2 Module
- File: `apps/server/src/ee/page-permission/page-permission.module.ts`

### 4.3 Service
- File: `apps/server/src/ee/page-permission/page-permission.service.ts`
- Methods:
  - restrictPage() / unrestrictPage()
  - addPermission() / removePermission() / updatePermission()
  - getPermissionMembers()
  - getPageRestrictionInfo()

### 4.4 Controller
- Routes: /pages/restrict, /pages/remove-restriction, /pages/add-permission, etc.

**Access Control**: Only space admins can manage permissions

---

## Step 5: AI Chat

**Files**: 7 files (migration already exists)

### 5.1 Repository
- Extend `apps/server/src/database/repos/ai-chat.repo.ts` (if exists)

### 5.2 AI Provider Service
- File: `apps/server/src/integrations/ai/ai-provider.service.ts`
- Abstraction for Claude/OpenAI

### 5.3 Module
- File: `apps/server/src/ee/ai/ai.module.ts`

### 5.4 Services
- File: `apps/server/src/ee/ai/ai-chat.service.ts` → CRUD chats
- File: `apps/server/src/ee/ai/ai-search.service.ts` → Search messages

### 5.5 Controller
- Routes: /ai/chats/*, /ai/generate

**Key Decision**: Which AI provider?
- [ ] Claude API (recommended)
- [ ] OpenAI
- [ ] Other?

---

## Recommended Implementation Order

### Week 1
1. ✅ Create EE module structure
2. ✅ API Keys (P1)
3. ✅ Audit Logs (P1)
4. ✅ MFA (P1)

### Week 2
5. ✅ Page Permissions (P2)
6. ✅ AI Chat (P2)
7. ✅ Page Verification (P2)

### Week 3+
8-25. Remaining features in priority order

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `apps/server/src/app.module.ts` | Register EeModule here (line 88) |
| `apps/server/src/common/features.ts` | Feature enum |
| `apps/server/src/integrations/environment/license-check.service.ts` | License validation |
| `apps/server/src/integrations/audit/audit.service.ts` | Audit logging |
| `apps/client/src/ee/` | Reference client implementations |

---

## Common Patterns

### Feature Gate Guard
```typescript
@Post('/api-keys')
@UseGuards(FeatureGateGuard)
@SetMetadata('required_feature', Feature.API_KEYS)
getApiKeys() { ... }
```

### Or use decorator:
```typescript
@Post('/api-keys')
@RequireFeature(Feature.API_KEYS)
getApiKeys() { ... }
```

### Response Format
```typescript
// List endpoint
interface ListResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

// Detail endpoint
interface DetailResponse<T> {
  data: T;
  message?: string;
}
```

### Audit Logging
```typescript
this.auditService.log({
  event: 'api_key_created',
  resourceType: 'api_key',
  resourceId: apiKey.id,
  changes: { name: 'my-key' },
});
```

---

## Testing Each Feature

```bash
# 1. Test module loads
npm run dev
# Check server starts without errors

# 2. Test endpoint
curl -X POST http://localhost:3000/api/[endpoint] \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'

# 3. Check audit logs
POST /audit

# 4. Test feature gating
# Disable feature in license service, endpoint should fail
```

---

## Deployment Checklist

Before marking feature as complete:

- [ ] Database migration runs successfully
- [ ] Feature gate decorator working (enabled/disabled)
- [ ] Audit logs recorded for operations
- [ ] API response format matches client expectations
- [ ] Error handling (validation, not found, etc.)
- [ ] Rate limiting configured
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Works with real client
- [ ] Security review done

---

## When Stuck

1. **Check client expectations**: `apps/client/src/ee/[feature]/services/`
2. **Check database schema**: `apps/server/src/database/migrations/`
3. **Check existing patterns**: Similar features in `/apps/server/src/core/`
4. **Check audit service**: Integration pattern in `page.controller.ts`

---

## Next Steps

1. ✅ Read this document → understand overall architecture
2. ✅ Read `EE_IMPLEMENTATION_PLAN.md` → detailed specs per feature
3. Create EE module structure (Step 0)
4. Implement Priority 1 features (Steps 1-3)
5. Get approval from team
6. Proceed to Priority 2-6 features

---

**For questions or clarifications, refer to EE_IMPLEMENTATION_PLAN.md**
