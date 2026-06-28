# SSO Scope Correction

**Date**: 2026-06-27  
**Issue**: Initial SSO scope was incomplete  
**Status**: ✅ CORRECTED

---

## What Was Wrong

Initial SSO implementation plan only considered **OIDC** with a fixed callback URL pattern `/api/sso/oidc/callback`.

## What Was Actually Required

SSO implementation must support **4 different authentication protocols** with different configurations, callbacks, and implementations:

1. **Google OAuth2**
2. **OpenID Connect (OIDC)**
3. **SAML 2.0**
4. **LDAP**

---

## Impact Analysis

### Effort

| Protocol | Hours | Complexity |
|----------|-------|-----------|
| Google OAuth2 | 4-6 | Low |
| OIDC | 6-8 | Medium |
| SAML 2.0 | 8-10 | High |
| LDAP | 8-12 | High |
| Shared Infrastructure | 6-8 | Medium |
| **Total** | **34-48** | **High** |

**Previous Estimate**: 16 hours  
**Corrected Estimate**: 34-48 hours  
**Increase**: +18-32 hours (+113% to +200%)

### Timeline

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Phase 3 Duration | Days 11-19 (8 days) | Days 11-25 (14+ days) | +6 days |
| Total Project | 3-5 weeks | 5-7 weeks | +2 weeks |
| Total Effort | 280 hours | 312-326 hours | +32-46 hours |

### Features Affected

Only Phase 3 (Priority 2) is affected:

| Feature | Hours | Status |
|---------|-------|--------|
| Page Permissions | 16 | Unchanged |
| SSO (all 4 protocols) | 34-48 | **Updated** |
| Page Verification | 10 | Unchanged |
| **Phase 3 Total** | 60-74 | **+18-32 hrs** |

---

## Callback URL Patterns (Corrected)

### Google OAuth2
```
Fixed callback (workspace-wide):
/api/sso/google/callback

Login:
/api/sso/google/login?workspaceId={workspaceId}&redirect={redirect}
```

### OIDC
```
Dynamic callback (per provider):
/api/sso/oidc/{providerId}/callback

Login:
/api/sso/oidc/{providerId}/login?redirect={redirect}

Configuration:
- oidcIssuer (URL)
- oidcClientId
- oidcClientSecret (encrypted)
- allowSignup
- groupSync
```

### SAML 2.0
```
Dynamic callback/ACS (per provider):
/api/sso/saml/{providerId}/callback

Entity ID:
/api/sso/saml/{providerId}/login

Metadata:
/api/sso/saml/{providerId}/metadata

Configuration:
- samlUrl (IDP Login URL)
- samlCertificate (IDP Certificate)
- allowSignup
- groupSync
```

### LDAP
```
No callback (direct authentication):
POST /api/sso/ldap/{providerId}/login
Request: { username, password }
Response: { token, user }

Configuration:
- ldapUrl
- ldapBindDn
- ldapBindPassword (encrypted)
- ldapBaseDn
- ldapUserSearchFilter
- ldapTlsEnabled
- ldapTlsCaCert (optional)
- allowSignup
- groupSync
```

---

## Implementation Complexity

### By Protocol

**Google OAuth2** (4-6 hours)
- Standard OAuth2 flow
- Simple configuration
- No certificate management
- Straightforward implementation

**OIDC** (6-8 hours)
- Discovery endpoint
- Authorization Code Flow with PKCE
- ID token validation
- Claims mapping
- More complex than Google

**SAML 2.0** (8-10 hours)
- SP certificate management
- SAML assertion parsing
- XML signature validation
- RelayState handling
- Metadata generation
- Requires cryptographic knowledge

**LDAP** (8-12 hours)
- Connection management
- Service account binding
- User search with filters
- Password verification (bind as user)
- TLS/SSL support
- Group enumeration
- Most complex of all

---

## Files to Create/Update

### New Files
- `/apps/server/src/ee/sso/` (entire module)
  - sso.controller.ts
  - sso.service.ts
  - 4 strategy files (google, oidc, saml, ldap)
  - 4 service implementations
  - Utilities and types

- `/apps/server/src/database/migrations/20260627T140000-auth-providers.ts`

- `/apps/server/src/database/repos/auth-provider.repo.ts`

### Updated Documentation
- IMPLEMENTATION_ROADMAP.md (timeline corrected)
- Phase 3 section completely rewritten

---

## Implementation Order (Recommended)

1. **Database & Infrastructure** (6-8 hours)
   - Create auth_providers table
   - Create repository
   - Encryption utilities

2. **Google OAuth2** (4-6 hours)
   - Simplest, good foundation
   - Validates infrastructure

3. **OIDC** (6-8 hours)
   - Most common enterprise protocol
   - Builds on Google foundation

4. **SAML 2.0** (8-10 hours)
   - Complex but critical for enterprises
   - Needs cryptographic implementation

5. **LDAP** (8-12 hours)
   - Most complex
   - Legacy systems integration

---

## Key Differences from Initial Plan

### Initial (Incomplete)
```
SSO: OIDC only
- Callback: /api/sso/oidc/callback (fixed)
- Hours: ~16
- Protocols: 1
```

### Corrected (Complete)
```
SSO: 4 Protocols (Google, OIDC, SAML, LDAP)
- Callbacks: Dynamic per protocol type
- Hours: 34-48
- Protocols: 4
- Database: auth_providers table
- Implementations: 4 separate strategies
- Security: Secret encryption, certificate management
```

---

## Why This Changed

The initial analysis looked at the features enum and saw:
- `SSO_CUSTOM: 'sso:custom'`
- `SSO_GOOGLE: 'sso:google'`

But didn't account for the fact that SSO_CUSTOM encompasses **3 different protocols** (OIDC, SAML, LDAP), each with:
- Different configuration requirements
- Different callback URL patterns
- Different authentication flows
- Different security considerations
- Different implementation complexity

---

## Action Items

1. ✅ **Updated**: IMPLEMENTATION_ROADMAP.md with correct SSO scope
2. ✅ **Created**: SSO_IMPLEMENTATION_SPEC.md with complete specifications
3. ✅ **Updated**: Timeline from 3-5 weeks to 5-7 weeks
4. ✅ **Updated**: Total effort from 280 to 312-326 hours

---

## New Target Timeline

### Phase 1: Foundation (Days 1-3, 6 hours)
- EE module structure
- Feature decorator & guard

### Phase 2: Priority 1 (Days 4-10, 30 hours)
- API Keys
- Audit Logs
- MFA

### Phase 3: Priority 2 (Days 11-25, 60-74 hours)
- **SSO Infrastructure** (6-8 hours)
- **Google OAuth2** (4-6 hours)
- **OIDC** (6-8 hours)
- **SAML 2.0** (8-10 hours)
- **LDAP** (8-12 hours)
- Page Permissions (16 hours)
- Page Verification (10 hours)

### Phase 4: Priority 3+ (Days 26-40, 196 hours)
- 15 remaining features

### Phase 5: Testing & Polish (Weeks 6-7, 20 hours)
- QA, security review, optimization

**Total**: 312-326 hours ≈ **5-7 weeks** (1 dev) or **2-3 weeks** (2 devs)

---

## Documents Updated

1. ✅ IMPLEMENTATION_ROADMAP.md - Timeline and effort corrected
2. ✅ SSO_IMPLEMENTATION_SPEC.md - Complete specification created
3. ⏳ Other documents (EXECUTIVE_SUMMARY, README, etc.) need timeline updates

---

## Lessons Learned

1. **Verify client implementation details** - Don't assume from enum names
2. **Account for protocol variations** - Different protocols = different implementations
3. **Security adds complexity** - Certificate management, encryption, validation
4. **Callback patterns matter** - Dynamic vs fixed URLs affect complexity
5. **Legacy system support is complex** - LDAP integration requires special handling

---

**Status**: ✅ Analysis complete, documentation updated  
**Next Step**: Begin Phase 1 implementation with updated timeline expectations

---

*Note: This correction demonstrates the importance of thorough code review before estimation. SSO was initially severely underestimated due to incomplete analysis of the 4 different protocol implementations required.*
