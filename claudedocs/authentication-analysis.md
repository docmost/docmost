# Docmost Authentication System Analysis

**Analysis Date**: 2025-10-03
**Focus**: Login flow and LDAP authentication implementation for custom integration

---

## Executive Summary

Docmost implements a comprehensive authentication system with support for:
- **Standard email/password login** (core)
- **JWT-based session management** (core)
- **SSO providers** (Enterprise Edition): Google OAuth, SAML, OIDC, LDAP
- **Multi-factor authentication (MFA)** (Enterprise Edition)
- **SSO enforcement** at workspace level

**Key Finding**: LDAP authentication is already implemented as an Enterprise Edition (EE) feature with database schema support. The implementation uses the `ldapts` library and follows a standard SSO provider pattern.

---

## Architecture Overview

### Authentication Flow Components

```
┌─────────────────┐
│  Frontend (SPA) │
│  React + Vite   │
└────────┬────────┘
         │ HTTP POST /api/auth/login
         ↓
┌─────────────────────────────────────────┐
│  Backend (NestJS + Fastify)             │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  AuthController                  │  │
│  │  - login()                       │  │
│  │  - logout()                      │  │
│  │  - setupWorkspace()              │  │
│  └───────────┬──────────────────────┘  │
│              ↓                          │
│  ┌──────────────────────────────────┐  │
│  │  AuthService                     │  │
│  │  - Validates credentials         │  │
│  │  - Checks MFA requirements       │  │
│  └───────────┬──────────────────────┘  │
│              ↓                          │
│  ┌──────────────────────────────────┐  │
│  │  TokenService                    │  │
│  │  - Generates JWT tokens          │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
         │
         ↓ Set-Cookie: authToken (httpOnly)
┌─────────────────┐
│  Client Browser │
│  Cookie Storage │
└─────────────────┘
```

### Authentication Types

| Type | Location | Status | Library |
|------|----------|--------|---------|
| Email/Password | Core | ✅ Active | bcrypt |
| JWT Session | Core | ✅ Active | @nestjs/jwt, passport-jwt |
| Google OAuth | EE | ✅ Active | passport-google-oauth20 |
| SAML | EE | ✅ Active | @node-saml/passport-saml |
| OIDC | EE | ✅ Active | openid-client |
| LDAP | EE | ✅ Active | ldapts |
| MFA | EE | ✅ Active | otpauth |

---

## Standard Login Flow (Email/Password)

### 1. Frontend Initiation

**File**: `apps/client/src/features/auth/components/login-form.tsx:52`

```typescript
async function onSubmit(data: ILogin) {
  await signIn(data);
}
```

**Login DTO**:
```typescript
interface ILogin {
  email: string;
  password: string;
}
```

### 2. API Request

**File**: `apps/client/src/features/auth/services/auth-service.ts:14`

```typescript
export async function login(data: ILogin): Promise<ILoginResponse> {
  const response = await api.post<ILoginResponse>("/auth/login", data);
  return response.data;
}
```

### 3. Backend Processing

**File**: `apps/server/src/core/auth/auth.controller.ts:38-88`

```typescript
@Post('login')
async login(
  @AuthWorkspace() workspace: Workspace,
  @Res({ passthrough: true }) res: FastifyReply,
  @Body() loginInput: LoginDto,
) {
  // 1. Validate SSO enforcement
  validateSsoEnforcement(workspace);

  // 2. Check MFA requirements (if EE module available)
  if (isMfaModuleReady) {
    const mfaResult = await mfaService.checkMfaRequirements(...);
    if (mfaResult.userHasMfa || mfaResult.requiresMfaSetup) {
      return { userHasMfa: ..., requiresMfaSetup: ..., isMfaEnforced: ... };
    }
  }

  // 3. Perform standard login
  const authToken = await this.authService.login(loginInput, workspace.id);
  this.setAuthCookie(res, authToken);
}
```

### 4. Credential Validation

**File**: `apps/server/src/core/auth/services/auth.service.ts:45-68`

```typescript
async login(loginDto: LoginDto, workspaceId: string) {
  // 1. Find user by email in workspace
  const user = await this.userRepo.findByEmail(loginDto.email, workspaceId, {
    includePassword: true,
  });

  // 2. Validate user exists and not deleted
  if (!user || user?.deletedAt) {
    throw new UnauthorizedException(errorMessage);
  }

  // 3. Verify password hash
  const isPasswordMatch = await comparePasswordHash(
    loginDto.password,
    user.password,
  );

  if (!isPasswordMatch) {
    throw new UnauthorizedException(errorMessage);
  }

  // 4. Update last login timestamp
  user.lastLoginAt = new Date();
  await this.userRepo.updateLastLogin(user.id, workspaceId);

  // 5. Generate JWT access token
  return this.tokenService.generateAccessToken(user);
}
```

### 5. Token Generation

**File**: `apps/server/src/core/auth/services/token.service.ts:25-37`

```typescript
async generateAccessToken(user: User): Promise<string> {
  if (user.deactivatedAt || user.deletedAt) {
    throw new ForbiddenException();
  }

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    workspaceId: user.workspaceId,
    type: JwtType.ACCESS,
  };
  return this.jwtService.sign(payload);
}
```

**JWT Configuration**: Uses `APP_SECRET` from environment, expiration set via `JWT_TOKEN_EXPIRES_IN` (default: 30d)

### 6. Cookie Setting

**File**: `apps/server/src/core/auth/auth.controller.ts:176-183`

```typescript
setAuthCookie(res: FastifyReply, token: string) {
  res.setCookie('authToken', token, {
    httpOnly: true,
    path: '/',
    expires: this.environmentService.getCookieExpiresIn(),
    secure: this.environmentService.isHttps(),
  });
}
```

### 7. Frontend Response Handling

**File**: `apps/client/src/features/auth/hooks/use-auth.ts:38-61`

```typescript
const handleSignIn = async (data: ILogin) => {
  setIsLoading(true);

  try {
    const response = await login(data);
    setIsLoading(false);

    // Check if MFA is required
    if (response?.userHasMfa) {
      navigate(APP_ROUTE.AUTH.MFA_CHALLENGE);
    } else if (response?.requiresMfaSetup) {
      navigate(APP_ROUTE.AUTH.MFA_SETUP_REQUIRED);
    } else {
      navigate(APP_ROUTE.HOME);
    }
  } catch (err) {
    // Handle error and show notification
  }
};
```

---

## LDAP Authentication (Enterprise Edition)

### Database Schema

**Migration**: `apps/server/src/database/migrations/20250831T202306-ldap-auth.ts`

**Table**: `auth_providers`

LDAP-specific columns:
- `ldap_url` - LDAP server URL (ldap:// or ldaps://)
- `ldap_bind_dn` - Service account DN for binding
- `ldap_bind_password` - Service account password
- `ldap_base_dn` - Base DN for user searches
- `ldap_user_search_filter` - Search filter with {{username}} placeholder
- `ldap_user_attributes` - JSONB mapping of LDAP to user attributes
- `ldap_tls_enabled` - Boolean for TLS/SSL connection
- `ldap_tls_ca_cert` - PEM-encoded CA certificate
- `ldap_config` - JSONB for additional configuration
- `settings` - JSONB for provider-specific settings
- `group_sync` - Boolean for group synchronization
- `allow_signup` - Allow auto-creation of users
- `is_enabled` - Provider enabled status

### Frontend LDAP Login

**File**: `apps/client/src/ee/security/services/ldap-auth-service.ts`

```typescript
interface ILdapLogin {
  username: string;
  password: string;
  providerId: string;
  workspaceId: string;
}

export async function ldapLogin(data: ILdapLogin): Promise<ILoginResponse> {
  const requestData = {
    username: data.username,
    password: data.password,
  };

  const response = await api.post<ILoginResponse>(
    `/sso/ldap/${data.providerId}/login`,
    requestData
  );

  return response.data;
}
```

**Expected Backend Route**: `POST /api/sso/ldap/:providerId/login`

### LDAP Configuration UI

**File**: `apps/client/src/ee/security/components/sso-ldap-form.tsx`

Configuration fields:
- Display name
- LDAP Server URL
- Bind DN (service account)
- Bind Password
- Base DN (search base)
- User Search Filter (e.g., `(mail={{username}})`)
- TLS/SSL enabled
- CA Certificate (optional)
- Group sync toggle
- Allow signup toggle
- Enabled toggle

### Backend LDAP Implementation

**Status**: Backend LDAP controller/service not found in core codebase - likely in EE server modules (not visible in empty `apps/server/src/ee` directory).

**Expected Implementation Pattern** (based on database schema and frontend):

```typescript
// Expected: apps/server/src/ee/sso/ldap/ldap.controller.ts
@Controller('sso/ldap')
export class LdapController {
  @Post(':providerId/login')
  async login(
    @Param('providerId') providerId: string,
    @Body() credentials: { username: string; password: string },
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    // 1. Get LDAP provider config from database
    const provider = await this.authProviderRepo.findById(providerId);

    // 2. Connect to LDAP server using ldapts
    const client = new Client({
      url: provider.ldapUrl,
      tlsOptions: provider.ldapTlsEnabled ? { ca: provider.ldapTlsCaCert } : {},
    });

    // 3. Bind with service account
    await client.bind(provider.ldapBindDn, provider.ldapBindPassword);

    // 4. Search for user
    const searchFilter = provider.ldapUserSearchFilter.replace('{{username}}', credentials.username);
    const { searchEntries } = await client.search(provider.ldapBaseDn, {
      filter: searchFilter,
      scope: 'sub',
    });

    // 5. Validate user found
    if (searchEntries.length === 0) {
      throw new UnauthorizedException('User not found');
    }

    // 6. Authenticate user by binding with their credentials
    await client.bind(searchEntries[0].dn, credentials.password);

    // 7. Find or create user in Docmost
    let user = await this.findOrCreateUserFromLdap(searchEntries[0], provider, workspace);

    // 8. Generate JWT token
    const authToken = await this.tokenService.generateAccessToken(user);

    // 9. Set cookie and return
    this.setAuthCookie(res, authToken);
  }
}
```

**Library**: `ldapts` (v7.4.0) - Modern LDAP client for Node.js

---

## SSO Provider Architecture

### Database Tables

**`auth_providers`**: SSO provider configurations
- Supports: SAML, OIDC, Google, LDAP
- Workspace-scoped
- Type-specific configuration columns

**`auth_accounts`**: Links SSO accounts to Docmost users
- `user_id` → Docmost user
- `provider_user_id` → External identity (e.g., LDAP DN, Google ID)
- `auth_provider_id` → Provider configuration
- Unique constraint on `(user_id, auth_provider_id)`

### SSO Enforcement

**File**: `apps/server/src/core/auth/auth.util.ts:4-8`

```typescript
export function validateSsoEnforcement(workspace: Workspace) {
  if (workspace.enforceSso) {
    throw new BadRequestException('This workspace has enforced SSO login.');
  }
}
```

Workspaces can enforce SSO-only login, disabling standard email/password authentication.

### URL Pattern

SSO providers follow consistent URL patterns:

```
Google OAuth:  /api/sso/google/login
               /api/sso/google/callback

SAML:          /api/sso/saml/:providerId/login
               /api/sso/saml/:providerId/callback

OIDC:          /api/sso/oidc/:providerId/login
               /api/sso/oidc/:providerId/callback

LDAP:          /api/sso/ldap/:providerId/login
```

---

## JWT Authentication Strategy

### Strategy Implementation

**File**: `apps/server/src/core/auth/strategies/jwt.strategy.ts`

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private userRepo: UserRepo,
    private workspaceRepo: WorkspaceRepo,
    private readonly environmentService: EnvironmentService,
  ) {
    super({
      jwtFromRequest: (req: FastifyRequest) => {
        return req.cookies?.authToken || extractBearerTokenFromHeader(req);
      },
      ignoreExpiration: false,
      secretOrKey: environmentService.getAppSecret(),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: JwtPayload) {
    // 1. Validate token type
    if (!payload.workspaceId || payload.type !== JwtType.ACCESS) {
      throw new UnauthorizedException();
    }

    // 2. Validate workspace match
    if (req.raw.workspaceId && req.raw.workspaceId !== payload.workspaceId) {
      throw new UnauthorizedException('Workspace does not match');
    }

    // 3. Validate workspace exists
    const workspace = await this.workspaceRepo.findById(payload.workspaceId);
    if (!workspace) {
      throw new UnauthorizedException();
    }

    // 4. Validate user exists and active
    const user = await this.userRepo.findById(payload.sub, payload.workspaceId);
    if (!user || user.deactivatedAt || user.deletedAt) {
      throw new UnauthorizedException();
    }

    return { user, workspace };
  }
}
```

### JWT Token Types

```typescript
enum JwtType {
  ACCESS = 'access',           // Standard authentication (30d default)
  COLLAB = 'collab',          // Collaboration server (24h)
  EXCHANGE = 'exchange',       // Cross-domain token exchange (10s)
  ATTACHMENT = 'attachment',   // File access (1h)
  MFA_TOKEN = 'mfa',          // MFA verification (5m)
}
```

### Token Extraction

Supports two methods:
1. **Cookie**: `authToken` (httpOnly, primary method)
2. **Bearer Token**: Authorization header (fallback)

---

## Extension Points for Custom LDAP

### Option 1: Use Existing LDAP Provider (Recommended)

**Approach**: Configure LDAP provider through admin UI or database

**Steps**:
1. Access EE admin panel at `/settings/security`
2. Create new LDAP provider with:
   - LDAP server URL
   - Service account credentials (Bind DN/password)
   - Base DN for user searches
   - User search filter (customize for your schema)
   - Attribute mappings (if needed)
3. Enable provider and test login

**Advantages**:
- No code changes required
- Full UI support for configuration
- Database-backed configuration
- Supports multiple LDAP servers (different providers)

**Database Access** (if needed):
```sql
-- Insert LDAP provider
INSERT INTO auth_providers (
  name, type, workspace_id,
  ldap_url, ldap_bind_dn, ldap_bind_password, ldap_base_dn,
  ldap_user_search_filter, ldap_tls_enabled,
  is_enabled, allow_signup
) VALUES (
  'Corporate LDAP', 'ldap', '<workspace_id>',
  'ldap://ldap.company.com:389',
  'cn=docmost,ou=services,dc=company,dc=com',
  'service-password',
  'ou=users,dc=company,dc=com',
  '(mail={{username}})',
  false,
  true, true
);
```

### Option 2: Custom LDAP Strategy

**Approach**: Implement custom Passport strategy

**File Structure**:
```
apps/server/src/core/auth/strategies/
├── jwt.strategy.ts          (existing)
└── ldap.strategy.ts         (new)
```

**Implementation**:

```typescript
// apps/server/src/core/auth/strategies/ldap.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-ldapauth';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

@Injectable()
export class LdapStrategy extends PassportStrategy(Strategy, 'ldap') {
  constructor(private environmentService: EnvironmentService) {
    super({
      server: {
        url: environmentService.getLdapUrl(),
        bindDN: environmentService.getLdapBindDn(),
        bindCredentials: environmentService.getLdapBindPassword(),
        searchBase: environmentService.getLdapBaseDn(),
        searchFilter: '(mail={{username}})',
        tlsOptions: {
          rejectUnauthorized: true,
        },
      },
    });
  }

  async validate(user: any) {
    if (!user) {
      throw new UnauthorizedException('Invalid LDAP credentials');
    }

    // Map LDAP attributes to Docmost user
    return {
      email: user.mail,
      name: user.displayName || user.cn,
      ldapDn: user.dn,
    };
  }
}
```

**Controller**:

```typescript
// apps/server/src/core/auth/auth.controller.ts
@UseGuards(AuthGuard('ldap'))
@Post('login-ldap')
async loginLdap(
  @AuthUser() ldapUser: any,
  @AuthWorkspace() workspace: Workspace,
  @Res({ passthrough: true }) res: FastifyReply,
) {
  // Find or create user
  let user = await this.userRepo.findByEmail(ldapUser.email, workspace.id);

  if (!user && workspace.allowLdapSignup) {
    user = await this.signupService.signup({
      email: ldapUser.email,
      name: ldapUser.name,
      password: null, // LDAP-only user
    }, workspace.id);
  }

  if (!user) {
    throw new UnauthorizedException('User not found');
  }

  const authToken = await this.tokenService.generateAccessToken(user);
  this.setAuthCookie(res, authToken);
}
```

**Dependencies**:
```bash
pnpm add passport-ldapauth ldapauth-fork
pnpm add -D @types/passport-ldapauth
```

### Option 3: Direct LDAP Integration (Most Flexible)

**Approach**: Use `ldapts` library directly without Passport

**Service**:

```typescript
// apps/server/src/core/auth/services/ldap.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Client } from 'ldapts';

@Injectable()
export class LdapService {
  async authenticate(username: string, password: string) {
    const client = new Client({
      url: process.env.LDAP_URL,
      tlsOptions: {
        rejectUnauthorized: true,
        ca: process.env.LDAP_CA_CERT,
      },
    });

    try {
      // 1. Bind as service account
      await client.bind(
        process.env.LDAP_BIND_DN,
        process.env.LDAP_BIND_PASSWORD
      );

      // 2. Search for user
      const { searchEntries } = await client.search(
        process.env.LDAP_BASE_DN,
        {
          filter: `(mail=${username})`,
          scope: 'sub',
          attributes: ['mail', 'displayName', 'cn', 'dn'],
        }
      );

      if (searchEntries.length === 0) {
        throw new UnauthorizedException('User not found');
      }

      const userEntry = searchEntries[0];

      // 3. Verify user password by binding as user
      await client.bind(userEntry.dn as string, password);

      // 4. Return user attributes
      return {
        email: userEntry.mail,
        name: userEntry.displayName || userEntry.cn,
        dn: userEntry.dn,
      };
    } finally {
      await client.unbind();
    }
  }
}
```

**Controller Integration**:

```typescript
@Post('login-ldap')
async loginLdap(
  @Body() credentials: { username: string; password: string },
  @AuthWorkspace() workspace: Workspace,
  @Res({ passthrough: true }) res: FastifyReply,
) {
  // Authenticate with LDAP
  const ldapUser = await this.ldapService.authenticate(
    credentials.username,
    credentials.password
  );

  // Find or create user
  let user = await this.userRepo.findByEmail(ldapUser.email, workspace.id);

  if (!user) {
    user = await this.signupService.signup({
      email: ldapUser.email,
      name: ldapUser.name,
      hasGeneratedPassword: true, // Mark as LDAP-only
    }, workspace.id);
  }

  const authToken = await this.tokenService.generateAccessToken(user);
  this.setAuthCookie(res, authToken);
}
```

---

## Security Considerations

### Password Security

- **Hashing**: bcrypt (salt rounds configurable)
- **Storage**: Only hashed passwords stored in database
- **Comparison**: Constant-time comparison via bcrypt

### JWT Security

- **Secret**: 32+ character `APP_SECRET` (environment variable)
- **Expiration**: Configurable via `JWT_TOKEN_EXPIRES_IN`
- **Storage**: httpOnly cookies (prevents XSS)
- **Transmission**: HTTPS-only in production (`secure` flag)
- **Validation**: Signature verification on every request

### LDAP Security

- **TLS/SSL**: Supported via `ldaps://` or STARTTLS
- **Certificate Validation**: CA certificate can be configured
- **Service Account**: Separate bind DN with limited permissions
- **Password Transmission**: Never stored/logged, only used for bind

### Workspace Isolation

- **User Scope**: Users belong to specific workspaces
- **JWT Validation**: Includes workspace ID in token payload
- **Query Filtering**: All database queries scoped to workspace
- **SSO Configuration**: Per-workspace SSO providers

---

## Configuration Reference

### Environment Variables

```bash
# Core Authentication
APP_SECRET=<32+ character secret>        # JWT signing key
JWT_TOKEN_EXPIRES_IN=30d                 # Access token expiration

# LDAP (if using custom implementation)
LDAP_URL=ldap://ldap.company.com:389
LDAP_BIND_DN=cn=service,dc=company,dc=com
LDAP_BIND_PASSWORD=<service-password>
LDAP_BASE_DN=ou=users,dc=company,dc=com
LDAP_USER_FILTER=(mail={{username}})
LDAP_TLS_ENABLED=false
LDAP_CA_CERT=<PEM certificate>
```

### Database Configuration

**Check existing LDAP providers**:
```sql
SELECT id, name, type, ldap_url, is_enabled
FROM auth_providers
WHERE type = 'ldap' AND deleted_at IS NULL;
```

**User with LDAP account**:
```sql
SELECT u.email, u.name, aa.provider_user_id
FROM users u
JOIN auth_accounts aa ON u.id = aa.user_id
JOIN auth_providers ap ON aa.auth_provider_id = ap.id
WHERE ap.type = 'ldap';
```

---

## Recommendations

### For Custom LDAP Implementation

1. **Use Option 1** (existing EE LDAP provider) if:
   - You have access to Enterprise Edition
   - Standard LDAP authentication is sufficient
   - No custom attribute mappings needed
   - UI-based configuration is acceptable

2. **Use Option 3** (direct `ldapts` integration) if:
   - Need custom LDAP logic or attribute mapping
   - Want full control over authentication flow
   - Need to integrate with custom user provisioning
   - Implementing additional LDAP features (group sync, etc.)

3. **Avoid Option 2** (Passport LDAP strategy):
   - `passport-ldapauth` is less maintained
   - Direct `ldapts` integration is more flexible
   - Passport adds unnecessary abstraction layer

### Implementation Checklist

- [ ] Verify LDAP server connectivity (ldapsearch test)
- [ ] Configure service account with minimal permissions
- [ ] Test user search filter with various usernames
- [ ] Implement error handling for LDAP connection failures
- [ ] Add logging for authentication attempts
- [ ] Set up user auto-provisioning if needed
- [ ] Configure attribute mapping (email, name, groups)
- [ ] Test with multiple users
- [ ] Implement TLS/SSL for production
- [ ] Document LDAP configuration for admins
- [ ] Add health check for LDAP connectivity
- [ ] Consider fallback to local auth if LDAP is down

### Testing Strategy

1. **Unit Tests**: Mock LDAP client for service layer tests
2. **Integration Tests**: Use test LDAP server (e.g., ldap-test-server)
3. **E2E Tests**: Full login flow with Playwright
4. **Manual Tests**:
   - Valid credentials
   - Invalid credentials
   - Non-existent user
   - LDAP server down
   - Network timeout
   - TLS certificate errors

---

## Additional Resources

### Key Files Reference

**Backend Core**:
- `apps/server/src/core/auth/auth.controller.ts` - Main auth endpoints
- `apps/server/src/core/auth/services/auth.service.ts` - Login logic
- `apps/server/src/core/auth/services/token.service.ts` - JWT generation
- `apps/server/src/core/auth/strategies/jwt.strategy.ts` - JWT validation
- `apps/server/src/core/auth/auth.util.ts` - SSO enforcement helper

**Frontend Core**:
- `apps/client/src/features/auth/components/login-form.tsx` - Login UI
- `apps/client/src/features/auth/hooks/use-auth.ts` - Auth state management
- `apps/client/src/features/auth/services/auth-service.ts` - API calls

**Enterprise Edition (LDAP)**:
- `apps/client/src/ee/security/services/ldap-auth-service.ts` - LDAP login API
- `apps/client/src/ee/security/components/sso-ldap-form.tsx` - LDAP config UI
- `apps/client/src/ee/security/types/security.types.ts` - SSO provider types

**Database**:
- `apps/server/src/database/migrations/20250118T194658-sso-auth.ts` - SSO tables
- `apps/server/src/database/migrations/20250831T202306-ldap-auth.ts` - LDAP fields
- `apps/server/src/database/types/db.d.ts` - Generated schema types

### Dependencies

```json
{
  "authentication": {
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/passport": "^11.0.5",
    "passport-jwt": "^4.0.1",
    "bcrypt": "^5.1.1"
  },
  "sso": {
    "ldapts": "^7.4.0",
    "passport-google-oauth20": "^2.0.0",
    "@node-saml/passport-saml": "^5.1.0",
    "openid-client": "^5.7.1"
  },
  "mfa": {
    "otpauth": "^9.4.0"
  }
}
```

---

## Conclusion

Docmost has a well-structured authentication system with:
- ✅ Clean separation between core and enterprise features
- ✅ Comprehensive SSO support including LDAP
- ✅ JWT-based session management
- ✅ Workspace-scoped authentication
- ✅ MFA support (EE)
- ✅ Database schema ready for LDAP

**For custom LDAP implementation**, the recommended approach is to use the direct `ldapts` integration (Option 3) for maximum flexibility and control, implementing it as a new controller in `apps/server/src/core/auth/` or as an EE feature in `apps/server/src/ee/sso/ldap/`.

The existing database schema and frontend UI for LDAP suggest that the backend implementation likely exists in the Enterprise Edition build but is not visible in the open-source codebase.
