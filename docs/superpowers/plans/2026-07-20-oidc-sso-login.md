# OIDC SSO Login (Entra ID) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the missing server-side OIDC authorization-code login flow (`GET /sso/oidc/:providerId/login` + `/callback`) so that admin-configured OIDC providers — including Microsoft Entra ID (Azure AD), which is stored as a flavor of `type: 'oidc'` — can actually authenticate a user, instead of 404ing as they do today.

**Architecture:** A new `OidcAuthService` in `apps/server/src/ee/sso-auth/` uses the already-installed `openid-client@6.8.2` package to discover the provider's OIDC configuration from `oidc_issuer`, build the authorization URL, and on callback exchange the code for tokens, verify the ID token, and provision/log in the local user — following the exact `sessionService.createSessionAndToken()` → `res.setCookie('authToken', ...)` pattern already used by the LDAP login route. CSRF/replay protection uses a short-lived signed httpOnly cookie carrying `state`+`nonce`+`providerId` (no new DB table). Providers whose issuer looks like Microsoft Entra ID (`login.microsoftonline.com`) additionally get routed through the already-built-but-orphaned `AuthOidcLoginHandler` hook (Azure AD plugin) for extra token/tenant validation and optional group/avatar sync — this requires registering the `auth:oidcLogin` hook name on `CoreHooks` and actually calling `runHook()`, which nothing does today.

**Tech Stack:** NestJS + Fastify, `openid-client` v6 (functional API), existing `SessionService`/`TokenService`, existing EE hook registry.

**Out of scope (flagged, not built here):** SAML login (`@node-saml/passport-saml` installed, unused, no controller) and Google OAuth signup/login (`passport-google-oauth20` installed, unused, no controller) — these are separate, equally-broken flows the user did not ask about. Do not touch them in this plan. Also out of scope: fixing the `avatarSync` client field having no DB column (pre-existing gap, unrelated to login working).

## Global Constraints

- Golden Rule: all new logic goes in `apps/server/src/ee/sso-auth/` (existing EE module) or `apps/server/src/ee/plugins/azure-ad/` (existing EE plugin). The only core-file touches allowed are additive: one new `CoreHooks` enum member, and (if truly needed) a route-registration-order note — no core business logic.
- Cookie contract: `res.setCookie('authToken', token, { httpOnly: true, sameSite: 'lax', path: '/', expires: this.environmentService.getCookieExpiresIn(), secure: this.environmentService.isHttps() })` — match `AuthController.setAuthCookie`'s full option set, not the LDAP route's abbreviated one.
- Session creation: always via `this.sessionService.createSessionAndToken(user)` — never hand-roll a JWT.
- Route shape: `GET /sso/oidc/:providerId/login` and `GET /sso/oidc/:providerId/callback` for ALL oidc-flavored providers (including Entra ID) — no path-param-less singleton route. This requires a client-side fix (Task 5) so Azure AD providers build the same `:providerId`-scoped URL as generic OIDC, removing the URL-shape special-case entirely.
- User matching: by email, same as the existing LDAP flow (`sso-auth.service.ts`) — do not build `AuthAccountRepo`/`auth_accounts` lookups in this plan; that table is unused today and out of scope.
- On any failure (discovery fails, state/nonce mismatch, token exchange fails, email missing, signup not allowed and no existing user), redirect the browser to `${appUrl}/login?error=sso_failed` — never return raw JSON to a browser navigation, since this is a full-page redirect flow.

---

## File Structure

- Create: `apps/server/src/ee/sso-auth/oidc-auth.service.ts` — discovery, authorization URL building, callback handling, user provisioning.
- Create: `apps/server/src/ee/sso-auth/oidc-state.util.ts` — signed state cookie encode/decode (HMAC using `APP_SECRET`).
- Modify: `apps/server/src/ee/sso-auth/sso-auth.controller.ts` — add the two new routes.
- Modify: `apps/server/src/ee/sso-auth/sso-auth.module.ts` — register `OidcAuthService`.
- Modify: `apps/server/src/core/plugins/plugin-hooks.ts` — add `AUTH_OIDC_LOGIN = 'auth:oidcLogin'` to `CoreHooks`.
- Modify: `apps/client/src/ee/security/sso.utils.ts` — remove the Azure-AD-singleton URL special case; always build `:providerId`-scoped URLs for `oidc` and `azure-ad` types.
- Test: `apps/server/src/ee/sso-auth/oidc-auth.service.spec.ts`.

---

### Task 1: Signed state/nonce cookie utility (CSRF + replay protection)

**Files:**
- Create: `apps/server/src/ee/sso-auth/oidc-state.util.ts`
- Test: `apps/server/src/ee/sso-auth/oidc-state.util.spec.ts`

**Interfaces:**
- Produces: `encodeOidcState(payload: { providerId: string; nonce: string; state: string; redirect?: string }, secret: string): string` — returns a compact signed token (base64url payload + HMAC-SHA256 signature, `.`-joined).
- Produces: `decodeOidcState(token: string, secret: string): { providerId: string; nonce: string; state: string; redirect?: string } | null` — returns `null` on any signature mismatch, malformed input, or expiry (embed an `exp` unix timestamp, 10 minutes from encode, inside the payload and reject if past).

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/src/ee/sso-auth/oidc-state.util.spec.ts
import { encodeOidcState, decodeOidcState } from './oidc-state.util';

describe('oidc state util', () => {
  const secret = 'test-secret';

  it('round-trips a valid payload', () => {
    const token = encodeOidcState(
      { providerId: 'p1', nonce: 'n1', state: 's1', redirect: '/home' },
      secret,
    );
    const decoded = decodeOidcState(token, secret);
    expect(decoded).toEqual({ providerId: 'p1', nonce: 'n1', state: 's1', redirect: '/home' });
  });

  it('rejects a tampered token', () => {
    const token = encodeOidcState({ providerId: 'p1', nonce: 'n1', state: 's1' }, secret);
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    expect(decodeOidcState(tampered, secret)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = encodeOidcState({ providerId: 'p1', nonce: 'n1', state: 's1' }, secret);
    expect(decodeOidcState(token, 'other-secret')).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = encodeOidcState(
      { providerId: 'p1', nonce: 'n1', state: 's1' },
      secret,
      -1, // ttlSeconds in the past
    );
    expect(decodeOidcState(token, secret)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/server exec jest oidc-state.util.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/server/src/ee/sso-auth/oidc-state.util.ts
import { createHmac, timingSafeEqual } from 'crypto';

interface OidcStatePayload {
  providerId: string;
  nonce: string;
  state: string;
  redirect?: string;
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function encodeOidcState(
  payload: OidcStatePayload,
  secret: string,
  ttlSeconds = 600,
): string {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const json = Buffer.from(JSON.stringify(body)).toString('base64url');
  const signature = sign(json, secret);
  return `${json}.${signature}`;
}

export function decodeOidcState(
  token: string,
  secret: string,
): OidcStatePayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [json, signature] = parts;

  const expectedSignature = sign(json, secret);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const body = JSON.parse(Buffer.from(json, 'base64url').toString('utf8'));
    if (typeof body.exp !== 'number' || body.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    const { providerId, nonce, state, redirect } = body;
    if (!providerId || !nonce || !state) return null;
    return { providerId, nonce, state, redirect };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter ./apps/server exec jest oidc-state.util.spec.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/ee/sso-auth/oidc-state.util.ts apps/server/src/ee/sso-auth/oidc-state.util.spec.ts
git commit -m "feat(sso-auth): add signed OIDC state/nonce cookie utility"
```

---

### Task 2: Register the `auth:oidcLogin` hook name on `CoreHooks`

**Files:**
- Modify: `apps/server/src/core/plugins/plugin-hooks.ts`

**Interfaces:**
- Produces: `CoreHooks.AUTH_OIDC_LOGIN = 'auth:oidcLogin'` — the exact string the Azure AD plugin's `azure-ad.module.ts` already registers a listener for (`hookRegistry.on('auth:oidcLogin', ...)`), so no change needed on the listener side.

- [ ] **Step 1: Read the current enum**

Read `apps/server/src/core/plugins/plugin-hooks.ts` in full to find the `CoreHooks` enum's `auth` section (near `BEFORE_LOGIN`/`AFTER_LOGIN`).

- [ ] **Step 2: Add the member**

```ts
// inside the existing CoreHooks enum, alongside BEFORE_LOGIN/AFTER_LOGIN
AUTH_OIDC_LOGIN = 'auth:oidcLogin',
```

This is a pure additive enum member — no conditional, no new logic. This file lives under `core/plugins/`, which is core-owned infrastructure explicitly designed to be the hook-declaration surface (not business logic), so a one-line additive enum entry here is the correct minimal touch.

- [ ] **Step 3: Verify no existing member collides**

Run: `grep -n "AUTH_OIDC_LOGIN\|auth:oidcLogin" apps/server/src/core/plugins/plugin-hooks.ts`
Expected: exactly one new line added, no duplicate.

- [ ] **Step 4: Compile check**

Run: `pnpm --filter ./apps/server exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/core/plugins/plugin-hooks.ts
git commit -m "feat(plugins): register auth:oidcLogin as a declared core hook"
```

---

### Task 3: `OidcAuthService` — discovery, authorization URL, callback handling

**Files:**
- Create: `apps/server/src/ee/sso-auth/oidc-auth.service.ts`
- Test: `apps/server/src/ee/sso-auth/oidc-auth.service.spec.ts`

**Interfaces:**
- Consumes: `AuthProviderRepo.findById(providerId, workspaceId)` (existing, from `apps/server/src/ee/sso/auth-provider.repo.ts`); `SessionService.createSessionAndToken(user)` (existing, from `apps/server/src/core/session/session.service.ts`); `encodeOidcState`/`decodeOidcState` from Task 1; `runHook`/`getHookRegistry` from `apps/server/src/ee/plugins/services/hook.registry.ts` and `apps/server/src/core/plugins/plugin-hooks.ts`'s `CoreHooks.AUTH_OIDC_LOGIN` from Task 2; `EnvironmentService` (existing, for `APP_SECRET`/`getAppUrl()`); a user repo/service with `findByEmail(email, workspaceId)` and a create-user method — grep `apps/server/src/core/user` for the existing `UserRepo`/`UserService` methods used by `sso-auth.service.ts`'s LDAP auto-provisioning path and reuse the identical method names (do not invent new ones).
- Produces:
  - `OidcAuthService.buildAuthorizationUrl(providerId: string, workspaceId: string, redirect?: string): Promise<{ url: string; stateCookie: string }>` — throws `NotFoundException` if provider missing/disabled/wrong type; throws `BadRequestException` if `oidcIssuer`/`oidcClientId`/`oidcClientSecret` are not all set.
  - `OidcAuthService.handleCallback(params: { code: string; state: string; stateCookie: string; workspaceId: string }): Promise<{ authToken: string; redirect?: string }>` — throws on state mismatch, discovery failure, token exchange failure, or missing email claim.

- [ ] **Step 1: Write the failing test for the authorization-URL builder's validation**

```ts
// apps/server/src/ee/sso-auth/oidc-auth.service.spec.ts
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OidcAuthService } from './oidc-auth.service';
import { AuthProviderRepo } from '../sso/auth-provider.repo';
import { SessionService } from '../../core/session/session.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';

describe('OidcAuthService.buildAuthorizationUrl', () => {
  let service: OidcAuthService;
  let authProviderRepo: { findById: jest.Mock };

  beforeEach(async () => {
    authProviderRepo = { findById: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OidcAuthService,
        { provide: AuthProviderRepo, useValue: authProviderRepo },
        { provide: SessionService, useValue: {} },
        {
          provide: EnvironmentService,
          useValue: {
            getAppSecret: () => 'test-secret',
            getAppUrl: () => 'http://localhost:3000',
            getServerAppUrl: () => 'http://localhost:3000',
            isHttps: () => false,
          },
        },
      ],
    }).compile();
    service = moduleRef.get(OidcAuthService);
  });

  it('throws NotFoundException when provider is missing', async () => {
    authProviderRepo.findById.mockResolvedValue(undefined);
    await expect(
      service.buildAuthorizationUrl('p1', 'ws1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when oidcIssuer is not configured', async () => {
    authProviderRepo.findById.mockResolvedValue({
      id: 'p1',
      type: 'oidc',
      isEnabled: true,
      oidcIssuer: null,
      oidcClientId: 'cid',
      oidcClientSecret: 'secret',
    });
    await expect(
      service.buildAuthorizationUrl('p1', 'ws1'),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/server exec jest oidc-auth.service.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `OidcAuthService`**

Before writing this file, read `apps/server/src/ee/sso-auth/sso-auth.service.ts` in full to copy its exact user-lookup/auto-provisioning pattern (method names on whatever user repo/service it injects), and read `apps/server/src/ee/plugins/azure-ad/services/token-validation.service.ts` to confirm whether its JWKS logic should be reused for non-Azure issuers too, or whether `openid-client`'s own built-in ID-token verification (via `client.authorizationCodeGrant`, which validates signature/`nonce`/`exp`/`aud`/`iss` automatically per the `openid-client` v6 API) makes that redundant — prefer relying on `openid-client`'s built-in verification for generic OIDC, and only additionally invoke the `AUTH_OIDC_LOGIN` hook for Entra-flavored issuers (detected via `oidcIssuer.includes('login.microsoftonline.com')`), since the hook's `AuthOidcLoginHandler` already re-validates the token itself — don't double-implement JWKS verification in this service.

```ts
// apps/server/src/ee/sso-auth/oidc-auth.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as client from 'openid-client';
import { AuthProviderRepo } from '../sso/auth-provider.repo';
import { SessionService } from '../../core/session/session.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { encodeOidcState, decodeOidcState } from './oidc-state.util';
import { runHook } from '../../core/plugins/plugin-hooks';
import { CoreHooks } from '../../core/plugins/plugin-hooks';
// import the user repo/service actually used by sso-auth.service.ts's LDAP
// auto-provisioning path, matching its exact method names (findByEmail /
// create-user) — read that file first, do not guess the import path here.

@Injectable()
export class OidcAuthService {
  constructor(
    private readonly authProviderRepo: AuthProviderRepo,
    private readonly sessionService: SessionService,
    private readonly environmentService: EnvironmentService,
    // + the same user repo/service dependency sso-auth.service.ts uses
  ) {}

  private isEntraIssuer(issuer: string): boolean {
    return issuer.includes('login.microsoftonline.com');
  }

  async buildAuthorizationUrl(
    providerId: string,
    workspaceId: string,
    redirect?: string,
  ): Promise<{ url: string; stateCookie: string }> {
    const provider = await this.authProviderRepo.findById(providerId, workspaceId);
    if (!provider || !provider.isEnabled || provider.type !== 'oidc') {
      throw new NotFoundException('SSO provider not found');
    }
    if (!provider.oidcIssuer || !provider.oidcClientId || !provider.oidcClientSecret) {
      throw new BadRequestException('OIDC provider is not fully configured');
    }

    const config = await client.discovery(
      new URL(provider.oidcIssuer),
      provider.oidcClientId,
      provider.oidcClientSecret,
    );

    const state = client.randomState();
    const nonce = client.randomNonce();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

    const callbackUrl = `${this.environmentService.getServerAppUrl()}/api/sso/oidc/${providerId}/callback`;
    const authUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl,
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const stateCookie = encodeOidcState(
      { providerId, nonce, state, redirect, codeVerifier } as any,
      this.environmentService.getAppSecret(),
    );

    return { url: authUrl.href, stateCookie };
  }

  async handleCallback(params: {
    code: string;
    stateParam: string;
    stateCookie: string;
    workspaceId: string;
  }): Promise<{ authToken: string; redirect?: string }> {
    const decoded = decodeOidcState(params.stateCookie, this.environmentService.getAppSecret());
    if (!decoded || decoded.state !== params.stateParam) {
      throw new BadRequestException('Invalid or expired SSO state');
    }

    const provider = await this.authProviderRepo.findById(decoded.providerId, params.workspaceId);
    if (!provider || !provider.isEnabled || provider.type !== 'oidc') {
      throw new NotFoundException('SSO provider not found');
    }

    const config = await client.discovery(
      new URL(provider.oidcIssuer),
      provider.oidcClientId,
      provider.oidcClientSecret,
    );

    const callbackUrl = `${this.environmentService.getServerAppUrl()}/api/sso/oidc/${decoded.providerId}/callback`;
    const currentUrl = new URL(callbackUrl);
    currentUrl.searchParams.set('code', params.code);
    currentUrl.searchParams.set('state', params.stateParam);

    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: (decoded as any).codeVerifier,
      expectedState: decoded.state,
      expectedNonce: decoded.nonce,
    });

    const claims = tokens.claims();
    let email = claims?.email as string | undefined;
    let name = (claims?.name as string | undefined) ?? email;

    if (provider.oidcIssuer && this.isEntraIssuer(provider.oidcIssuer)) {
      const hookResult = await runHook(CoreHooks.AUTH_OIDC_LOGIN, {
        providerId: decoded.providerId,
        idToken: tokens.id_token,
        accessToken: tokens.access_token,
        workspaceId: params.workspaceId,
        config: provider,
      });
      if (hookResult?.email) {
        email = hookResult.email;
        name = hookResult.name ?? name;
      }
    }

    if (!email) {
      throw new BadRequestException('SSO provider did not return an email claim');
    }

    // find-or-create user by email + workspaceId, matching sso-auth.service.ts's
    // exact LDAP auto-provisioning method calls (allowSignup gate, same repo/service).
    // <implementer: mirror that block verbatim here, substituting `email`/`name`>

    const authToken = await this.sessionService.createSessionAndToken(/* resolved user */ undefined as any);
    return { authToken, redirect: decoded.redirect };
  }
}
```

The `handleCallback` body's user-provisioning line is intentionally left as a marked stub — implement it by reading `sso-auth.service.ts`'s `ldapLogin` method in full and copying its exact "find user by email in workspace, else if `provider.allowSignup` create one, else throw" block verbatim, adapted to this method's variable names. Do not invent a different provisioning policy.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./apps/server exec jest oidc-auth.service.spec.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Add tests for the callback's state-mismatch and missing-email paths**

```ts
// append to oidc-auth.service.spec.ts
describe('OidcAuthService.handleCallback', () => {
  it('throws BadRequestException when state does not match the cookie', async () => {
    // build a real stateCookie via encodeOidcState with state:'s1', then call
    // handleCallback with stateParam:'s2' and assert BadRequestException
  });
});
```

Fill in this test using `encodeOidcState` imported directly (Task 1), matching the constructor mocks from Step 1. Run and confirm PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/ee/sso-auth/oidc-auth.service.ts apps/server/src/ee/sso-auth/oidc-auth.service.spec.ts
git commit -m "feat(sso-auth): implement OIDC authorization-code login/callback service"
```

---

### Task 4: Wire the login/callback routes onto `SsoAuthController`

**Files:**
- Modify: `apps/server/src/ee/sso-auth/sso-auth.controller.ts`
- Modify: `apps/server/src/ee/sso-auth/sso-auth.module.ts`
- Test: `apps/server/src/ee/sso-auth/sso-auth.controller.spec.ts`

**Interfaces:**
- Consumes: `OidcAuthService.buildAuthorizationUrl`/`handleCallback` (Task 3).
- Produces: `GET /sso/oidc/:providerId/login?redirect=<path>` (302 to the IdP, sets a `oidc_state` cookie), `GET /sso/oidc/:providerId/callback?code=&state=` (302 to `${appUrl}${redirect ?? '/'}` with `authToken` cookie set on success, or `${appUrl}/login?error=sso_failed` on any thrown exception).

- [ ] **Step 1: Read the current controller and module**

Read `apps/server/src/ee/sso-auth/sso-auth.controller.ts` and `sso-auth.module.ts` in full (already known to be small, ~39 and ~13 lines respectively) to match existing decorator/import style exactly.

- [ ] **Step 2: Add the two routes**

```ts
// apps/server/src/ee/sso-auth/sso-auth.controller.ts — add imports:
import { Get, Param, Query, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { OidcAuthService } from './oidc-auth.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';

// add to constructor:
private readonly oidcAuthService: OidcAuthService,
private readonly environmentService: EnvironmentService,

// add routes, alongside the existing ldapLogin route:
@Get('oidc/:providerId/login')
async oidcLogin(
  @Param('providerId') providerId: string,
  @Query('redirect') redirect: string | undefined,
  @AuthWorkspace() workspace: Workspace,
  @Res({ passthrough: true }) res: FastifyReply,
) {
  const { url, stateCookie } = await this.oidcAuthService.buildAuthorizationUrl(
    providerId,
    workspace.id,
    redirect,
  );
  res.setCookie('oidc_state', stateCookie, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res.redirect(url);
}

@Get('oidc/:providerId/callback')
async oidcCallback(
  @Param('providerId') providerId: string,
  @Query('code') code: string,
  @Query('state') state: string,
  @AuthWorkspace() workspace: Workspace,
  @Res({ passthrough: true }) res: FastifyReply,
  @Req() req: FastifyRequest,
) {
  const appUrl = this.environmentService.getAppUrl();
  const stateCookie = req.cookies?.['oidc_state'];
  try {
    if (!code || !state || !stateCookie) {
      throw new Error('Missing OIDC callback parameters');
    }
    const { authToken, redirect } = await this.oidcAuthService.handleCallback({
      code,
      stateParam: state,
      stateCookie,
      workspaceId: workspace.id,
    });
    res.setCookie('authToken', authToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
    });
    res.clearCookie('oidc_state', { path: '/' });
    return res.redirect(`${appUrl}${redirect ?? '/'}`);
  } catch {
    res.clearCookie('oidc_state', { path: '/' });
    return res.redirect(`${appUrl}/login?error=sso_failed`);
  }
}
```

Add whatever `@Req`/`FastifyRequest` import is needed, matching the file's existing Fastify import style. Note the `:providerId` path segment means this route family never collides with the admin CRUD routes on `SsoController` (different controller, different base — `sso-auth` vs `sso`), and does not need the workspace-singleton `oidc/login` (no param) route at all, since Task 5 removes that URL shape client-side.

- [ ] **Step 3: Register `OidcAuthService` in the module**

```ts
// apps/server/src/ee/sso-auth/sso-auth.module.ts
providers: [SsoAuthService, OidcAuthService],
```

- [ ] **Step 4: Write a controller-level test for the error-redirect path**

```ts
// apps/server/src/ee/sso-auth/sso-auth.controller.spec.ts
import { Test } from '@nestjs/testing';
import { SsoAuthController } from './sso-auth.controller';
import { SsoAuthService } from './sso-auth.service';
import { OidcAuthService } from './oidc-auth.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';

describe('SsoAuthController.oidcCallback', () => {
  it('redirects to /login?error=sso_failed when the state cookie is missing', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SsoAuthController],
      providers: [
        { provide: SsoAuthService, useValue: {} },
        { provide: OidcAuthService, useValue: { handleCallback: jest.fn() } },
        { provide: EnvironmentService, useValue: { getAppUrl: () => 'http://localhost:3000' } },
      ],
    }).compile();

    const controller = moduleRef.get(SsoAuthController);
    const res: any = { setCookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };
    const req: any = { cookies: {} };

    await controller.oidcCallback('p1', 'code1', 'state1', { id: 'ws1' } as any, res, req);

    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/login?error=sso_failed');
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter ./apps/server exec jest sso-auth.controller.spec.ts`
Expected: PASS, 1/1.

- [ ] **Step 6: Compile and lint**

Run: `pnpm --filter ./apps/server exec tsc --noEmit && pnpm --filter ./apps/server run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/ee/sso-auth/sso-auth.controller.ts apps/server/src/ee/sso-auth/sso-auth.module.ts apps/server/src/ee/sso-auth/sso-auth.controller.spec.ts
git commit -m "feat(sso-auth): expose GET oidc/:providerId/login and /callback routes"
```

---

### Task 5: Client — remove the Azure-AD-singleton URL special case

**Files:**
- Modify: `apps/client/src/ee/security/sso.utils.ts`

**Interfaces:**
- Produces: `buildSsoLoginUrl`/`buildCallbackUrl` build `.../oidc/${providerId}/login` and `.../oidc/${providerId}/callback` for BOTH `SSO_PROVIDER.OIDC` and `SSO_PROVIDER.AZURE_AD` types — no more path-param-less route for Azure AD.

- [ ] **Step 1: Read the current file in full**

Read `apps/client/src/ee/security/sso.utils.ts` (61 lines) to get exact current branch structure before editing.

- [ ] **Step 2: Remove the Azure AD special case**

In `buildCallbackUrl`, delete the `if (type === SSO_PROVIDER.AZURE_AD) return ...oidc/callback` branch (no `providerId`) so Azure AD falls through to the same line generic OIDC/SAML use: `` `${domain}/api/sso/${type === SSO_PROVIDER.AZURE_AD ? 'oidc' : type}/${providerId}/callback` ``. Since the server route is always `oidc/:providerId/...` regardless of whether the provider is Azure-flavored (the server detects Entra by `oidcIssuer` content, not by a separate `type` value), map `SSO_PROVIDER.AZURE_AD` to the literal segment `'oidc'` in the URL, not `'azure-ad'`.

Apply the identical fix to `buildSsoLoginUrl`'s Azure AD branch.

- [ ] **Step 3: Verify no other caller depended on the old paramless shape**

Run: `grep -rn "azure-ad\|AZURE_AD" apps/client/src/ee/security apps/client/src/ee/components`
Expected: remaining references are only the `SSO_PROVIDER.AZURE_AD` enum usages for form-selection/type-detection, not URL building — confirm none of them still assume a paramless route.

- [ ] **Step 4: Compile check**

Run: `pnpm --filter ./apps/client exec tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Manual verification**

Run: `pnpm client:dev` + `pnpm server:dev`, configure an Entra ID provider (Tenant ID + Client ID + Client secret), click "Login with Entra ID" on the login page, confirm the browser navigates to `https://login.microsoftonline.com/...` (not a 404), and after completing Microsoft's login, lands back on the app authenticated.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/ee/security/sso.utils.ts
git commit -m "fix(sso): route Azure AD login/callback through the providerId-scoped OIDC URL"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Run full server test suite**

Run: `pnpm --filter ./apps/server run test`
Expected: all pass except the pre-existing/unrelated failures already documented in this repo's other in-flight work (see `docs/superpowers/plans/2026-07-15-page-review-workflow.md`'s Task 12 report for the known baseline count) — no new failures.

- [ ] **Step 2: Manual walkthrough with a real Entra ID app registration**

Using a test Entra ID tenant: register an app, set redirect URI to `http://localhost:3000/api/sso/oidc/<providerId>/callback`, configure the provider in Docmost's SSO settings with Tenant ID/Client ID/Client secret, then walk the full login → consent → callback → authenticated-session path. Confirm: (a) a new user is auto-provisioned if `allowSignup` is on and no matching local user exists by email, (b) an existing user by matching email logs in without duplication, (c) revisiting `/sso/oidc/:providerId/login` twice in a row (simulating a replay) with a stale `oidc_state` cookie correctly redirects to `/login?error=sso_failed` rather than crashing.

- [ ] **Step 3: Commit any fixups found during manual verification**

```bash
git add -A
git commit -m "fix(sso-auth): address end-to-end OIDC login walkthrough findings"
```
