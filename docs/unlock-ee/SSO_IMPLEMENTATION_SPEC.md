# SSO Implementation Specification

**Updated**: 2026-06-27  
**Status**: CRITICAL - Updated from initial OIDC-only plan  
**Scope**: 4 SSO Provider Types with different protocols

---

## Overview

The SSO implementation (SSO_CUSTOM + SSO_GOOGLE features) supports 4 different provider types:

1. **Google OAuth2**
2. **OIDC (OpenID Connect)**
3. **SAML 2.0**
4. **LDAP**

Each provider type has different configuration requirements, callback patterns, and implementation complexity.

---

## 1. Google OAuth2 (SSO_GOOGLE)

### Callback URL
```
Fixed: /api/sso/google/callback
```

### Configuration Requirements
```typescript
{
  type: 'google',
  clientId: string,
  clientSecret: string,
  allowSignup: boolean,
  isEnabled: boolean
}
```

### Login URL
```
/api/sso/google/login?workspaceId={workspaceId}&redirect={redirect}
```

### Signup URL
```
/api/sso/google/signup
```

### Implementation Notes
- Instance-wide configuration (not per-workspace)
- Fixed callback URL (no provider ID needed)
- Uses OAuth2 authorization code flow
- Redirect back to login page with token

### Estimated Effort: 4-6 hours

---

## 2. OIDC (OpenID Connect) - SSO_CUSTOM

### Callback URL
```
Dynamic: /api/sso/oidc/{providerId}/callback
```

### Configuration Requirements
```typescript
{
  type: 'oidc',
  providerId: string (UUID),
  name: string,
  oidcIssuer: string (URL to OIDC provider)
  oidcClientId: string,
  oidcClientSecret: string,
  allowSignup: boolean,
  groupSync: boolean,
  isEnabled: boolean
}
```

### Required Fields in IAuthProvider Entity
- `id` (providerId)
- `type` ('oidc')
- `name`
- `oidcIssuer`
- `oidcClientId`
- `oidcClientSecret`
- `allowSignup`
- `groupSync`
- `isEnabled`

### Login URL
```
/api/sso/oidc/{providerId}/login?redirect={redirect}
```

### Implementation Notes
- Multiple providers can be configured
- Requires OIDC discovery endpoint support
- Authorization Code Flow with PKCE recommended
- State parameter for CSRF protection
- Group/claims mapping if groupSync enabled
- Dynamic callback URL per provider ID

### Estimated Effort: 6-8 hours

---

## 3. SAML 2.0 - SSO_CUSTOM

### Callback URL (Assertion Consumer Service)
```
Dynamic: /api/sso/saml/{providerId}/callback
```

### Entity ID
```
Dynamic: /api/sso/saml/{providerId}/login
```

### Configuration Requirements
```typescript
{
  type: 'saml',
  providerId: string (UUID),
  name: string,
  samlUrl: string (IDP Login URL),
  samlCertificate: string (IDP Certificate in PEM format),
  allowSignup: boolean,
  groupSync: boolean,
  isEnabled: boolean
}
```

### Required Fields in IAuthProvider Entity
- `id` (providerId)
- `type` ('saml')
- `name`
- `samlUrl` (IDP Login URL)
- `samlCertificate` (IDP Certificate)
- `allowSignup`
- `groupSync`
- `isEnabled`

### SAML Metadata Generation
```
Endpoint: /api/sso/saml/{providerId}/metadata

Returns SAML 2.0 Service Provider metadata:
- Assertion Consumer Service (ACS) Endpoint
- Single Logout Service Endpoint
- SP Certificate (self-signed or CA)
- Entity ID
```

### Login URL
```
/api/sso/saml/{providerId}/login?redirect={redirect}
```

### Implementation Notes
- SAML 2.0 POST binding
- Requires SP certificate (self-signed is OK)
- SAML assertion validation with IDP certificate
- RelayState handling for redirect
- Attribute mapping for user data
- Optional group attribute mapping if groupSync enabled
- Metadata endpoint for provider configuration

### Estimated Effort: 8-10 hours

---

## 4. LDAP - SSO_CUSTOM

### No Callback URL
```
Direct Authentication (no OAuth flow)
```

### Configuration Requirements
```typescript
{
  type: 'ldap',
  providerId: string (UUID),
  name: string,
  ldapUrl: string (ldap:// or ldaps://)
  ldapBindDn: string,
  ldapBindPassword: string (encrypted),
  ldapBaseDn: string,
  ldapUserSearchFilter: string,
  ldapTlsEnabled: boolean,
  ldapTlsCaCert: string (optional),
  allowSignup: boolean,
  groupSync: boolean,
  isEnabled: boolean
}
```

### Required Fields in IAuthProvider Entity
- `id` (providerId)
- `type` ('ldap')
- `name`
- `ldapUrl`
- `ldapBindDn`
- `ldapBindPassword` (encrypted)
- `ldapBaseDn`
- `ldapUserSearchFilter`
- `ldapTlsEnabled`
- `ldapTlsCaCert` (optional)
- `allowSignup`
- `groupSync`
- `isEnabled`

### Login Flow
```
POST /api/sso/ldap/{providerId}/login
Request: { username, password }
Response: { token, user }

1. Bind to LDAP with service account
2. Search for user using ldapUserSearchFilter
3. Verify password by binding as user
4. Extract user attributes (email, groups, etc.)
5. Return JWT token and user info
```

### Implementation Notes
- Direct authentication (no redirect)
- Service account binding for searches
- User DN construction from search results
- TLS/SSL support (optional, recommended)
- CA certificate validation if TLS enabled
- User attribute mapping (email, displayName, groups)
- Optional group membership extraction if groupSync enabled
- No logout endpoint needed (stateless)

### Estimated Effort: 8-12 hours

---

## Shared Components

### Common Configuration
All SSO providers share:
- `allowSignup`: Allow new users to sign up via this provider
- `groupSync`: Sync user groups from provider
- `isEnabled`: Enable/disable provider
- Workspace-level configuration

### Common Endpoints
```
POST /sso/create        - Create new SSO provider
POST /sso/update        - Update provider config
POST /sso/delete        - Delete provider
POST /sso/info          - Get SSO config
POST /sso/providers     - List all SSO providers
```

### Database Schema (IAuthProvider)
```sql
CREATE TABLE auth_providers (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  type VARCHAR NOT NULL, -- 'google', 'oidc', 'saml', 'ldap'
  name VARCHAR NOT NULL,
  
  -- Google specific
  google_client_id VARCHAR,
  google_client_secret VARCHAR (encrypted),
  
  -- OIDC specific
  oidc_issuer VARCHAR,
  oidc_client_id VARCHAR,
  oidc_client_secret VARCHAR (encrypted),
  
  -- SAML specific
  saml_url VARCHAR,
  saml_certificate TEXT,
  
  -- LDAP specific
  ldap_url VARCHAR,
  ldap_bind_dn VARCHAR,
  ldap_bind_password VARCHAR (encrypted),
  ldap_base_dn VARCHAR,
  ldap_user_search_filter VARCHAR,
  ldap_tls_enabled BOOLEAN,
  ldap_tls_ca_cert TEXT,
  
  -- Common
  allow_signup BOOLEAN DEFAULT TRUE,
  group_sync BOOLEAN DEFAULT FALSE,
  is_enabled BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(workspace_id, type), -- Only one provider per type per workspace
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX idx_auth_providers_workspace ON auth_providers(workspace_id);
```

---

## API Endpoint Summary

### Management Endpoints
```
POST /sso/create            # Create provider
POST /sso/update            # Update provider config
POST /sso/delete            # Delete provider
POST /sso/info              # Get workspace SSO config
POST /sso/providers         # List configured providers
```

### Authentication Endpoints
```
Google:
  GET  /api/sso/google/login?workspaceId=X&redirect=X
  GET  /api/sso/google/signup
  POST /api/sso/google/callback

OIDC:
  GET  /api/sso/oidc/{providerId}/login?redirect=X
  POST /api/sso/oidc/{providerId}/callback

SAML:
  GET  /api/sso/saml/{providerId}/login?redirect=X
  POST /api/sso/saml/{providerId}/callback
  GET  /api/sso/saml/{providerId}/metadata

LDAP:
  POST /api/sso/ldap/{providerId}/login
       Request: { username, password }
       Response: { token, user }
```

---

## Implementation Breakdown

### Phase 3: SSO Implementation (Days 11-19, 42 hours total)

**3.1 Database & Shared Infrastructure (6-8 hours)**
- Create auth_providers table migration
- Create AuthProvider entity/repository
- Create SsoService base class
- Create SsoController base class
- Implement generic endpoints (create, update, delete, list)
- Add encryption for secrets (OIDC client secret, LDAP password)

**3.2 Google OAuth2 (4-6 hours)**
- Implement Google OAuth2 flow
- Google Credential Manager integration
- Login/signup endpoints
- Callback handling
- Session creation
- Error handling

**3.3 OIDC (6-8 hours)**
- OIDC discovery endpoint handling
- Authorization code flow with PKCE
- Token endpoint integration
- ID token validation
- Claims extraction
- Group/scope mapping
- Callback per provider ID

**3.4 SAML 2.0 (8-10 hours)**
- SP certificate management (self-signed)
- SAML request generation
- Assertion parsing and validation
- Signature verification with IDP certificate
- Attribute mapping
- Group extraction
- RelayState handling
- SAML metadata generation

**3.5 LDAP (8-12 hours)**
- LDAP connection management
- Service account binding
- User search and filter
- Password verification (bind as user)
- Attribute extraction
- TLS/SSL support
- Group enumeration
- User sync logic

**3.6 Shared Features (2-4 hours)**
- Group sync implementation
- Allow signup validation
- User creation from SSO attributes
- Workspace member auto-provisioning
- Email/username conflicts handling
- Session management across providers

---

## Security Considerations

### Secrets Management
- All secrets encrypted at rest:
  - Google client secret
  - OIDC client secret
  - LDAP bind password
  - SAML certificate (store separately)
- Use workspace encryption key for encryption
- Decrypt only when needed for API calls

### Protocol Security
**Google OAuth2**:
- Use state parameter
- Verify authorization code exchange
- Validate ID token signature

**OIDC**:
- State parameter (CSRF protection)
- PKCE (Proof Key for Code Exchange)
- ID token signature validation
- Nonce validation

**SAML**:
- Assertion signature validation
- Response timestamp validation
- Assertion consumer service URL validation
- Prevent XXE attacks
- Validate NotOnOrAfter conditions

**LDAP**:
- Secure LDAP (ldaps://) recommended
- TLS certificate validation
- No plaintext connections
- Bind as user for password verification
- Protect service account credentials

### Session Security
- Generate secure JWT tokens
- Include workspace ID in token claims
- Set appropriate token expiration
- Validate token on each request
- Provide logout endpoint

---

## Testing Strategy

### Unit Tests
- Secret encryption/decryption
- URL building
- Filter construction (LDAP)
- Assertion parsing (SAML)

### Integration Tests
- Full flow for each provider type
- Error handling for each protocol
- Group sync validation
- User creation from SSO
- Workspace auto-provisioning

### Manual Testing
- Real Google OAuth2 app
- Real OIDC provider (Auth0, Okta, etc.)
- Real SAML provider (Azure Entra, Okta, etc.)
- Real LDAP server (Active Directory, OpenLDAP, etc.)

---

## Configuration Examples

### Google
```json
{
  "type": "google",
  "name": "Google",
  "clientId": "xyz.apps.googleusercontent.com",
  "clientSecret": "secret",
  "allowSignup": true,
  "isEnabled": true
}
```

### OIDC (Auth0)
```json
{
  "type": "oidc",
  "name": "Auth0",
  "oidcIssuer": "https://tenant.auth0.com",
  "oidcClientId": "abc123",
  "oidcClientSecret": "secret",
  "allowSignup": true,
  "groupSync": true,
  "isEnabled": true
}
```

### SAML (Azure Entra)
```json
{
  "type": "saml",
  "name": "Azure Entra",
  "samlUrl": "https://login.microsoftonline.com/.../saml2",
  "samlCertificate": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
  "allowSignup": true,
  "groupSync": true,
  "isEnabled": true
}
```

### LDAP (Active Directory)
```json
{
  "type": "ldap",
  "name": "Active Directory",
  "ldapUrl": "ldaps://ad.company.com:636",
  "ldapBindDn": "cn=service,cn=users,dc=company,dc=com",
  "ldapBindPassword": "secret",
  "ldapBaseDn": "dc=company,dc=com",
  "ldapUserSearchFilter": "(&(objectClass=user)(mail={{username}}))",
  "ldapTlsEnabled": true,
  "allowSignup": true,
  "groupSync": true,
  "isEnabled": true
}
```

---

## Effort Summary

| Component | Hours | Complexity |
|-----------|-------|-----------|
| Database & Infrastructure | 6-8 | Medium |
| Google OAuth2 | 4-6 | Low |
| OIDC | 6-8 | Medium |
| SAML 2.0 | 8-10 | High |
| LDAP | 8-12 | High |
| Shared Features | 2-4 | Low |
| **TOTAL** | **34-48 hours** | **High** |

**Updated Timeline for Phase 3**:
- Previous estimate: 42 hours
- New estimate: 34-48 hours (more realistic)
- Previous days: 11-19 (8-9 days)
- New days: 11-21 (10-11 days)

---

## Recommended Implementation Order

1. **Database & Infrastructure** (6-8 hours)
2. **Google OAuth2** (4-6 hours) - Simplest, good foundation
3. **OIDC** (6-8 hours) - Most common enterprise protocol
4. **SAML 2.0** (8-10 hours) - Complex but important
5. **LDAP** (8-12 hours) - Most complex, legacy systems

---

## Files to Create

```
/apps/server/src/ee/sso/
├── sso.module.ts
├── sso.controller.ts
├── sso.service.ts
├── types/
│   ├── sso.types.ts
│   └── auth-provider.types.ts
├── strategies/
│   ├── google.strategy.ts
│   ├── oidc.strategy.ts
│   ├── saml.strategy.ts
│   └── ldap.strategy.ts
├── services/
│   ├── google-sso.service.ts
│   ├── oidc-sso.service.ts
│   ├── saml-sso.service.ts
│   └── ldap-sso.service.ts
└── utils/
    ├── sso-url-builder.ts
    ├── encryption.utils.ts
    └── user-mapper.ts

/apps/server/src/database/
├── repos/
│   └── auth-provider.repo.ts
└── migrations/
    └── 20260627T140000-auth-providers.ts
```

---

**Status**: ✅ Complete SSO specification updated  
**Next Step**: Update IMPLEMENTATION_ROADMAP.md with correct SSO scope
