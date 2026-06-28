# EE Features Implementation Roadmap

**Status**: 🔴 CRITICAL - Server implementation not started  
**Created**: 2026-06-27  
**Last Updated**: 2026-06-27  
**Target Completion**: 5-7 weeks (1 developer, full-time)  
**Note**: AI Chat feature removed. SSO scope expanded to 4 protocols (Google, OIDC, SAML, LDAP)

---

## Overview

**What's Complete** ✅
- Client UI for 23 EE features (200+ files)
- Database migrations for 2 features (audit, page-permissions)
- Audit infrastructure (write-only)
- License gating framework
- 4 SSO protocols fully designed on client (Google, OIDC, SAML, LDAP)

**What's Missing** ❌
- 52+ REST API endpoints
- 23 EE feature modules
- 23+ service implementations
- 9+ database migrations
- Feature decorators and guards
- All business logic
- SSO implementation (4 protocols: 34-48 hours)

---

## Phase 1: Foundation (Days 1-3)

### 1.1 Create EE Module Structure

**Files to Create**: 3

#### Create `/apps/server/src/ee/ee.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { ApiKeyModule } from './api-key/api-key.module';
import { AuditModule } from './audit/audit.module';
import { MfaModule } from './mfa/mfa.module';
// ... import other modules as implemented

@Module({
  imports: [
    ApiKeyModule,
    AuditModule,
    MfaModule,
    // Add others here
  ],
})
export class EeModule {}
```

#### Create `/apps/server/src/ee/ee.controller.ts`
```typescript
import { Controller } from '@nestjs/common';

@Controller('')
export class EeController {
  // Empty - sub-controllers handle routing
}
```

#### Update `/apps/server/src/app.module.ts` (line 88)
Change from:
```typescript
...enterpriseModules,
```

To:
```typescript
EeModule,  // Always load in dev/production
...enterpriseModules,
```

**Checklist**:
- [ ] Create ee.module.ts
- [ ] Create ee.controller.ts
- [ ] Update app.module.ts import
- [ ] Test server starts without errors
- [ ] Verify no console errors

---

### 1.2 Create Feature Gating Infrastructure

**Files to Create**: 3

#### Create `/apps/server/src/ee/common/decorators/require-feature.decorator.ts`
```typescript
import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { FeatureKey } from '../../../common/features';
import { FeatureGateGuard } from '../guards/feature-gate.guard';

export const REQUIRED_FEATURE_KEY = 'required_feature';

export function RequireFeature(feature: FeatureKey) {
  return applyDecorators(
    UseGuards(FeatureGateGuard),
    SetMetadata(REQUIRED_FEATURE_KEY, feature),
  );
}
```

#### Create `/apps/server/src/ee/common/guards/feature-gate.guard.ts`
```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicenseCheckService } from '../../../integrations/environment/license-check.service';
import { REQUIRED_FEATURE_KEY } from '../decorators/require-feature.decorator';

@Injectable()
export class FeatureGateGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private licenseCheckService: LicenseCheckService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFeature = this.reflector.get<string>(
      REQUIRED_FEATURE_KEY,
      context.getHandler(),
    );

    if (!requiredFeature) {
      return true; // No feature required
    }

    const request = context.switchToHttp().getRequest();
    const workspace = request.workspace; // Should be set by middleware
    
    if (!workspace) {
      throw new ForbiddenException('Workspace not found');
    }

    // For dev mode with UNLOCK_EE=true, allow all features
    const canAccess = this.licenseCheckService.hasFeature(
      workspace.licenseKey || '',
      requiredFeature,
    );

    if (!canAccess) {
      throw new ForbiddenException(
        `Feature '${requiredFeature}' is not available in your plan`,
      );
    }

    return true;
  }
}
```

#### Create `/apps/server/src/ee/common/index.ts`
```typescript
export * from './decorators/require-feature.decorator';
export * from './guards/feature-gate.guard';
```

**Checklist**:
- [ ] Create decorators folder
- [ ] Create guards folder
- [ ] Create require-feature.decorator.ts
- [ ] Create feature-gate.guard.ts
- [ ] Test decorator works on endpoint
- [ ] Test guard blocks disabled features

---

## Phase 2: Priority 1 Features (Days 4-10)

### 2.1 API Keys Management

**Expected Files**: 6 + 1 migration

#### Step 1: Create Migration

File: `/apps/server/src/database/migrations/20260627T120000-api-keys.ts`

```typescript
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('api_keys')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('key_hash', 'varchar', (col) => col.notNull().unique())
    .addColumn('scope', 'varchar', (col) =>
      col.defaultTo(sql`ARRAY['all']::varchar[]`),
    )
    .addColumn('expires_at', 'timestamptz')
    .addColumn('last_used_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('revoked_at', 'timestamptz')
    .addUniqueConstraint('uq_api_key_per_user', ['workspace_id', 'user_id', 'name'])
    .execute();

  await db.schema
    .createIndex('idx_api_keys_user')
    .on('api_keys')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_api_keys_workspace')
    .on('api_keys')
    .column('workspace_id')
    .execute();

  await db.schema
    .createIndex('idx_api_keys_hash')
    .on('api_keys')
    .column('key_hash')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('api_keys').execute();
}
```

**Checklist**:
- [ ] Create migration file
- [ ] Run migration: `npm run db:migrate`
- [ ] Verify table created in database
- [ ] Test rollback works

#### Step 2: Create Repository

File: `/apps/server/src/database/repos/api-key.repo.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Database } from '@docmost/db';
import { v7 as uuidv7 } from 'uuid';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ApiKeyRepo {
  constructor(private db: Database) {}

  async create(data: {
    workspaceId: string;
    userId: string;
    name: string;
    description?: string;
    expiresAt?: Date;
  }): Promise<{ id: string; key: string }> {
    const id = uuidv7();
    const key = this.generateKey();
    const keyHash = await bcrypt.hash(key, 10);

    await this.db
      .insertInto('api_keys')
      .values({
        id,
        workspace_id: data.workspaceId,
        user_id: data.userId,
        name: data.name,
        description: data.description,
        key_hash: keyHash,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();

    return { id, key };
  }

  async findByHash(keyHash: string) {
    return this.db
      .selectFrom('api_keys')
      .selectAll()
      .where('key_hash', '=', keyHash)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
  }

  async list(workspaceId: string, userId?: string, limit = 50, skip = 0) {
    let query = this.db
      .selectFrom('api_keys')
      .select(['id', 'name', 'description', 'created_at', 'last_used_at', 'expires_at'])
      .where('workspace_id', '=', workspaceId)
      .where('revoked_at', 'is', null)
      .orderBy('created_at', 'desc');

    if (userId) {
      query = query.where('user_id', '=', userId);
    }

    const total = await query.execute().then((r) => r.length);
    const items = await query.limit(limit).offset(skip).execute();

    return { items, total };
  }

  async updateById(id: string, data: { name?: string; description?: string; expiresAt?: Date }) {
    await this.db
      .updateTable('api_keys')
      .set({
        name: data.name,
        description: data.description,
        expires_at: data.expiresAt,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .execute();
  }

  async revokeById(id: string) {
    await this.db
      .updateTable('api_keys')
      .set({ revoked_at: new Date() })
      .where('id', '=', id)
      .execute();
  }

  private generateKey(): string {
    return 'dk_' + Buffer.from(Math.random().toString()).toString('base64').substring(0, 32);
  }
}
```

**Checklist**:
- [ ] Create repository file
- [ ] Implement all CRUD methods
- [ ] Use bcrypt for key hashing
- [ ] Generate keys with prefix (dk_)
- [ ] Test all methods

#### Step 3: Create Module

File: `/apps/server/src/ee/api-key/api-key.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyRepo } from '../../database/repos/api-key.repo';

@Module({
  providers: [ApiKeyService, ApiKeyRepo],
  controllers: [ApiKeyController],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
```

**Checklist**:
- [ ] Create module file
- [ ] Import in EeModule
- [ ] Declare providers and controllers

#### Step 4: Create Service

File: `/apps/server/src/ee/api-key/api-key.service.ts`

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiKeyRepo } from '../../database/repos/api-key.repo';
import { AUDIT_SERVICE, IAuditService } from '../../integrations/audit/audit.service';
import { Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ApiKeyService {
  constructor(
    private apiKeyRepo: ApiKeyRepo,
    @Inject(AUDIT_SERVICE) private auditService: IAuditService,
  ) {}

  async getApiKeys(workspaceId: string, userId: string, limit = 50, skip = 0) {
    return this.apiKeyRepo.list(workspaceId, userId, limit, skip);
  }

  async createApiKey(workspaceId: string, userId: string, data: any) {
    const result = await this.apiKeyRepo.create({
      workspaceId,
      userId,
      name: data.name,
      description: data.description,
      expiresAt: data.expiresAt,
    });

    this.auditService.log({
      event: 'api_key_created',
      resourceType: 'api_key',
      resourceId: result.id,
      changes: { name: data.name },
    });

    return result;
  }

  async updateApiKey(id: string, data: any) {
    await this.apiKeyRepo.updateById(id, data);

    this.auditService.log({
      event: 'api_key_updated',
      resourceType: 'api_key',
      resourceId: id,
      changes: data,
    });
  }

  async revokeApiKey(id: string) {
    await this.apiKeyRepo.revokeById(id);

    this.auditService.log({
      event: 'api_key_revoked',
      resourceType: 'api_key',
      resourceId: id,
    });
  }

  async validateApiKey(key: string): Promise<{ workspaceId: string; userId: string } | null> {
    // Extract hash from key and validate
    // This is used for API authentication
    try {
      const apiKey = await this.apiKeyRepo.findByHash(key);
      if (!apiKey || apiKey.revoked_at) return null;
      if (apiKey.expires_at && new Date() > apiKey.expires_at) return null;
      return { workspaceId: apiKey.workspace_id, userId: apiKey.user_id };
    } catch {
      return null;
    }
  }
}
```

**Checklist**:
- [ ] Create service file
- [ ] Implement all methods
- [ ] Inject AuditService
- [ ] Log all operations
- [ ] Handle errors gracefully

#### Step 5: Create Controller

File: `/apps/server/src/ee/api-key/api-key.controller.ts`

```typescript
import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';

@Controller('api-keys')
export class ApiKeyController {
  constructor(private apiKeyService: ApiKeyService) {}

  @Post()
  @RequireFeature(Feature.API_KEYS)
  async getApiKeys(@Body() body: any, @Request() req: any) {
    return this.apiKeyService.getApiKeys(
      req.workspace.id,
      req.user.id,
      body.limit || 50,
      body.skip || 0,
    );
  }

  @Post('create')
  @RequireFeature(Feature.API_KEYS)
  async createApiKey(@Body() body: any, @Request() req: any) {
    return this.apiKeyService.createApiKey(req.workspace.id, req.user.id, body);
  }

  @Post('update')
  @RequireFeature(Feature.API_KEYS)
  async updateApiKey(@Body() body: any) {
    await this.apiKeyService.updateApiKey(body.apiKeyId, body);
    return { success: true };
  }

  @Post('revoke')
  @RequireFeature(Feature.API_KEYS)
  async revokeApiKey(@Body() body: any) {
    await this.apiKeyService.revokeApiKey(body.apiKeyId);
    return { success: true };
  }
}
```

**Checklist**:
- [ ] Create controller file
- [ ] Add @RequireFeature decorator to all endpoints
- [ ] Validate request body
- [ ] Return proper response format
- [ ] Test with curl/Postman

#### Step 6: Add DTOs

File: `/apps/server/src/ee/api-key/types/api-key.dto.ts`

```typescript
export interface CreateApiKeyRequest {
  name: string;
  description?: string;
  expiresAt?: Date;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  keyPreview: string; // Last 4 chars only
}
```

**Checklist**:
- [ ] Create DTOs
- [ ] Export from index.ts
- [ ] Use in controller responses

---

### 2.2 Audit Logs Query Endpoints

**Expected Files**: 3 (DB already exists)

#### Create `/apps/server/src/ee/audit/audit-query.controller.ts`
```typescript
import { Controller, Post, Body, Request, Inject } from '@nestjs/common';
import { AuditQueryService } from './audit-query.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';
import { AUDIT_SERVICE, IAuditService } from '../../integrations/audit/audit.service';

@Controller('audit')
export class AuditQueryController {
  constructor(
    private auditQueryService: AuditQueryService,
    @Inject(AUDIT_SERVICE) private auditService: IAuditService,
  ) {}

  @Post()
  @RequireFeature(Feature.AUDIT_LOGS)
  async queryAuditLogs(@Body() body: any, @Request() req: any) {
    return this.auditQueryService.queryLogs(
      req.workspace.id,
      body.limit || 50,
      body.skip || 0,
      body,
    );
  }

  @Post('retention')
  @RequireFeature(Feature.AUDIT_LOGS)
  async getRetention(@Request() req: any) {
    return this.auditQueryService.getRetention(req.workspace.id);
  }

  @Post('retention/update')
  @RequireFeature(Feature.AUDIT_LOGS)
  async updateRetention(@Body() body: any, @Request() req: any) {
    return this.auditQueryService.updateRetention(
      req.workspace.id,
      body.auditRetentionDays,
    );
  }
}
```

#### Create `/apps/server/src/ee/audit/audit-query.service.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { Database } from '@docmost/db';

@Injectable()
export class AuditQueryService {
  constructor(private db: Database) {}

  async queryLogs(
    workspaceId: string,
    limit: number,
    skip: number,
    filters: any,
  ) {
    let query = this.db
      .selectFrom('audit')
      .selectAll()
      .where('workspace_id', '=', workspaceId);

    // Apply filters
    if (filters.eventType) {
      query = query.where('event', '=', filters.eventType);
    }
    if (filters.resourceType) {
      query = query.where('resource_type', '=', filters.resourceType);
    }
    if (filters.userId) {
      query = query.where('actor_id', '=', filters.userId);
    }
    if (filters.dateFrom) {
      query = query.where('created_at', '>=', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.where('created_at', '<=', filters.dateTo);
    }

    const total = await query.execute().then((r) => r.length);
    const items = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(skip)
      .execute();

    return { items, total, hasMore: skip + items.length < total };
  }

  async getRetention(workspaceId: string) {
    const workspace = await this.db
      .selectFrom('workspaces')
      .select('audit_retention_days')
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    return {
      retentionDays: workspace?.audit_retention_days || 90,
    };
  }

  async updateRetention(workspaceId: string, retentionDays: number) {
    await this.db
      .updateTable('workspaces')
      .set({ audit_retention_days: retentionDays })
      .where('id', '=', workspaceId)
      .execute();

    return { retentionDays };
  }

  // Scheduled job: run daily to clean up old audit logs
  async cleanupOldLogs() {
    // Query all workspaces with retention policies
    const workspaces = await this.db
      .selectFrom('workspaces')
      .select(['id', 'audit_retention_days'])
      .where('audit_retention_days', 'is not', null)
      .execute();

    for (const workspace of workspaces) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (workspace.audit_retention_days || 90));

      await this.db
        .deleteFrom('audit')
        .where('workspace_id', '=', workspace.id)
        .where('created_at', '<', cutoffDate)
        .execute();
    }
  }
}
```

#### Create `/apps/server/src/ee/audit/audit.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { AuditQueryService } from './audit-query.service';
import { AuditQueryController } from './audit-query.controller';

@Module({
  providers: [AuditQueryService],
  controllers: [AuditQueryController],
})
export class AuditModule {}
```

**Checklist**:
- [ ] Create controller
- [ ] Create service with query logic
- [ ] Create module
- [ ] Test with filters
- [ ] Setup retention cleanup job

---

### 2.3 MFA Implementation

**Expected Files**: 7 + 1 migration

This is complex. Refer to `EE_IMPLEMENTATION_PLAN.md` section 1.4 for detailed specs.

**Key Points**:
- Install `speakeasy` + `qrcode` libraries
- Create user_mfa table migration
- Implement TOTP generation/verification
- Integrate with auth flow
- Create 7 endpoints

**Checklist**:
- [ ] Create migration
- [ ] Create UserMfaRepo
- [ ] Create MfaService with TOTP
- [ ] Create MfaController
- [ ] Integrate in AuthController
- [ ] Test with authenticator apps
- [ ] Test backup codes

---

## Phase 3: Priority 2 Features (Days 11-19)

### 3.1 Page Permissions
- Implement restrict/unrestrict
- Add/remove/update permissions
- Member listing

### 3.2 SSO Configuration (4 Protocols: Google, OIDC, SAML, LDAP)

**IMPORTANT**: SSO supports 4 different authentication protocols with different implementations:

1. **Google OAuth2** (4-6 hours)
   - Callback: `/api/sso/google/callback` (fixed)
   - Login: `/api/sso/google/login?workspaceId=X`
   
2. **OIDC** (6-8 hours)
   - Callback: `/api/sso/oidc/{providerId}/callback` (dynamic per provider)
   - Issuer, ClientID, ClientSecret configuration
   - PKCE support
   
3. **SAML 2.0** (8-10 hours)
   - Callback: `/api/sso/saml/{providerId}/callback` (ACS endpoint)
   - Entity ID: `/api/sso/saml/{providerId}/login`
   - Metadata: `/api/sso/saml/{providerId}/metadata`
   - IDP Certificate verification
   
4. **LDAP** (8-12 hours)
   - Direct authentication (no callback)
   - TLS/SSL support
   - User search filter
   - Bind DN & password

**Total Effort**: 34-48 hours (instead of estimated 16 hours)

**See**: `SSO_IMPLEMENTATION_SPEC.md` for complete specification

### 3.3 Page Verification
- Cryptographic signing
- Verification status

---

## Phase 4: Priority 3+ Features (Days 20-35)

See `EE_IMPLEMENTATION_PLAN.md` for detailed specs on:
- Templates
- Bases (Database)
- SCIM
- Billing
- Security Settings
- Personal Spaces
- Sharing Controls
- etc.

---

## Implementation Checklist Template

### For Each Feature

```
Feature: [NAME]
Priority: P[1-6]
Effort: [8-24 hours]
Dependencies: [other features]

Files to Create:
- [ ] migration (if needed)
- [ ] repository
- [ ] module
- [ ] service
- [ ] controller
- [ ] DTOs/types
- [ ] tests

Endpoints:
- [ ] POST /endpoint1
- [ ] POST /endpoint2
- [ ] POST /endpoint3

Database:
- [ ] Migration created
- [ ] Tables verified
- [ ] Indices created
- [ ] Relationships verified

API Contract:
- [ ] Matches client expectations
- [ ] Request validation
- [ ] Error handling
- [ ] Response format

Testing:
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Tested with real client
- [ ] Audit logging verified

Security:
- [ ] Permission checks
- [ ] Rate limiting
- [ ] Input validation
- [ ] SQL injection protected

Performance:
- [ ] Indices on large tables
- [ ] Pagination implemented
- [ ] Caching considered

Documentation:
- [ ] API documented
- [ ] Usage examples
- [ ] Error codes
```

---

## Testing Strategy

### Unit Tests
```bash
npm run test -- ee/api-key/api-key.service.spec.ts
npm run test -- ee/mfa/mfa.service.spec.ts
npm run test -- ee/audit/audit-query.service.spec.ts
```

### Integration Tests
```bash
npm run test:e2e -- api-keys.spec.ts
npm run test:e2e -- mfa-flow.spec.ts
npm run test:e2e -- audit-logs.spec.ts
```

### Manual Testing
```bash
# Start server
npm run dev

# Test endpoint
curl -X POST http://localhost:3000/api/api-keys/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-key"}'
```

---

## Database Migrations Checklist

| Migration | File | Status | Priority |
|-----------|------|--------|----------|
| API Keys | `20260627T120000-api-keys.ts` | TODO | P1 |
| MFA | `20260627T130000-user-mfa.ts` | TODO | P1 |
| SCIM Tokens | TBD | TODO | P2 |
| Bases | TBD | TODO | P2 |
| Templates | TBD | TODO | P2 |
| SSO | TBD | TODO | P3 |
| Billing | TBD | TODO | P3 |
| Verification | TBD | TODO | P2 |
| Personal Spaces | TBD | TODO | P3 |
| Retention | TBD | TODO | P3 |

---

## Success Criteria by Phase

### Phase 1 ✅
- [ ] EE module loads successfully
- [ ] Feature gating works (decorator + guard)
- [ ] API Keys fully working (CRUD + audit)
- [ ] Audit Logs queryable (retrieve + retention)
- [ ] MFA implemented (setup + verify)
- [ ] All P1 endpoints tested with client
- [ ] No errors in server logs
- [ ] Feature flags working correctly

### Phase 2 ✅
- [ ] Page Permissions fully working
- [ ] SSO (Custom + Google) endpoints working
- [ ] OIDC callback URL working (/api/sso/oidc/callback)
- [ ] Page Verification implemented
- [ ] No regressions in Phase 1

### Phase 3 ✅
- [ ] All remaining features implemented (15 features)
- [ ] 52+ endpoints all working
- [ ] Comprehensive test coverage
- [ ] Documentation complete

### Overall ✅
- [ ] All 23 EE features functional
- [ ] Client UI works without errors
- [ ] Database clean and optimized
- [ ] Security review passed
- [ ] Performance acceptable
- [ ] Production-ready

---

## Deployment Checklist

- [ ] All migrations applied
- [ ] Feature flags verified
- [ ] Audit logging working
- [ ] Rate limiting configured
- [ ] API documentation generated
- [ ] Backward compatibility verified
- [ ] Performance baseline met
- [ ] Security review completed
- [ ] Rollback plan in place

---

## Resources

### Client Reference
- Feature services: `/apps/client/src/ee/[feature]/services/`
- Components: `/apps/client/src/ee/[feature]/components/`
- Types: `/apps/client/src/ee/[feature]/types/`

### Server Reference
- Existing controllers: `/apps/server/src/core/*/`
- Database repos: `/apps/server/src/database/repos/`
- Audit patterns: `/apps/server/src/core/page/page.controller.ts`

### Documentation
- Detailed plan: `EE_IMPLEMENTATION_PLAN.md`
- Feature audit: `EE_FEATURE_AUDIT.md`
- Quick reference: `EE_QUICK_REFERENCE.md`

---

**Start Date**: 2026-06-27  
**Target Completion**: 2026-08-15 (5 weeks)  
**Extended Target**: 2026-08-29 (7 weeks)

**Effort Breakdown**:
- Phase 1: 6 hours (Days 1-3)
- Phase 2: 30 hours (Days 4-10)
- Phase 3: 60-74 hours (Days 11-25) - SSO is 34-48 hours
- Phase 4: 196 hours (Days 26-40)
- Phase 5: 20 hours (Week 6-7)
- **Total**: 312-326 hours ≈ 5-7 weeks (1 dev)

**Note**: SSO implementation is significantly more complex than initially estimated due to supporting 4 different protocols (Google OAuth2, OIDC, SAML 2.0, LDAP) with different configurations and callback patterns.

Begin with Phase 1 (Foundation + P1 Features) immediately for maximum impact.
