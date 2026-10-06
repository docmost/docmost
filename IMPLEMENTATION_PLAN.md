# LDAP-Only Authentication Implementation Plan

## Status

Planning only. No implementation changes have been made.

## Agreed Scope

- Implement the LDAP backend in the core server; the `apps/server/src/ee` submodule is unavailable.
- LDAP is deployment-wide and controlled by environment configuration, not per-workspace LDAP settings.
- LDAP-only mode is supported for self-hosted deployments only. Enabling it when `CLOUD=true` must fail clearly rather than partially alter Cloud authentication.
- When LDAP mode is enabled, LDAP is the only interactive sign-in method for self-hosted deployments.
- Provision a Docmost account on the user's first successful LDAP login.
- Do not automatically link an LDAP identity to an existing, unlinked local account. Reject that login and require an explicit operator resolution.
- LDAP identity attribute mappings are configurable.
- The LDAP-authenticated user who completes initial workspace setup becomes the workspace owner; subsequent LDAP-provisioned users are members.
- Treat the email returned by the configured LDAP directory as verified for LDAP-provisioned accounts.
- Keep OAuth and API-key credentials available; LDAP-only mode applies to interactive sign-in.

## Existing Groundwork

- The server already depends on `ldapts`.
- A database migration added LDAP provider columns to `auth_providers` and `has_generated_password` to users: `apps/server/src/database/migrations/20250831T202306-ldap-auth.ts`.
- The client has LDAP provider configuration UI and a provider-specific login modal under `apps/client/src/ee`. The login currently expects a provider ID and calls `/sso/ldap/:providerId/login`, which does not match deployment-wide environment configuration.
- Normal login creates a persisted session, signs an access JWT, and sets the `authToken` HttpOnly cookie. LDAP login should use this existing session contract.
- The `users.password` database column is nullable, but `UserRepo.insertUser` currently hashes every supplied password. Passwordless LDAP accounts therefore require a deliberate repository/authentication change in a later implementation phase.
- `auth_accounts` currently lacks a uniqueness constraint on the external provider subject. Do not use it unchanged as the LDAP identity store.
- `apps/server/src/ee` is an uninitialized Git submodule. This plan does not rely on hidden server implementation being present.

## Proposed Configuration

Add a documented LDAP section to `.env.example`. Use the following names and conventions unless implementation discovery reveals a concrete incompatibility. All secrets and LDAP connection details remain server-side; only a non-secret auth-mode status may reach the client.

- `LDAP_ENABLED=false`
- `LDAP_URL`
- `LDAP_BIND_DN`
- `LDAP_BIND_PASSWORD`
- `LDAP_BASE_DN`
- `LDAP_USER_SEARCH_FILTER`, with `{{username}}` as the escaped login placeholder
- `LDAP_USER_ID_ATTRIBUTE`, required and configured to a stable directory subject for the target directory
- `LDAP_USER_EMAIL_ATTRIBUTE=mail`
- `LDAP_USER_NAME_ATTRIBUTE=displayName`, with `cn` as a fallback
- `LDAP_STARTTLS=false`; require `ldaps://` or StartTLS and never allow cleartext LDAP in production
- `LDAP_TLS_CA_CERT_PATH`, optional path to an additional trusted CA certificate
- `LDAP_CONNECT_TIMEOUT_MS=5000` and `LDAP_SEARCH_TIMEOUT_MS=5000`

Validate required settings on server startup when `LDAP_ENABLED=true`. Do not expose bind credentials, certificates, or other secrets through public configuration APIs or logs.
The search filter determines the login identifier attribute, allowing deployments to use `uid`, `mail`, `sAMAccountName`, or an equivalent directory attribute without hardcoding a vendor-specific default. There is no universal stable subject attribute, so `LDAP_USER_ID_ATTRIBUTE` must be explicitly set.

## Implementation Tasks

1. **Phase 1 complete: auth and bootstrap contracts**
   - LDAP-only mode is self-hosted-only and deployment-wide; reject `LDAP_ENABLED=true` with `CLOUD=true`.
   - Use a dedicated LDAP identity table keyed uniquely by `(workspace_id, stable_subject_id)`, with one LDAP identity per Docmost user per workspace. Do not reuse `auth_accounts` without redesigning its external-subject uniqueness.
   - LDAP account email is treated as verified. Existing unlinked local accounts with the same email are not automatically linked.
   - Initial LDAP-backed workspace setup authenticates the bootstrap user and makes that user the workspace owner. Subsequent first-time LDAP users receive the member role. Make workspace bootstrap transactional and concurrency-safe.
   - OAuth/API-key credentials remain enabled; only interactive authentication becomes LDAP-only.
   - LDAP users have no local password. Update user insertion and password login to handle `password = null` safely.
   - Attribute mappings and TLS/timeouts follow the Proposed Configuration above.

2. **Add server configuration and public auth-mode status**
   - Add typed environment settings, startup validation, and safe error messages.
   - Expose only whether LDAP-only mode is active so the client can render the correct sign-in view without duplicating runtime configuration.
   - Keep `LDAP_ENABLED=false` behavior unchanged.

3. **Implement LDAP authentication service and endpoint**
   - Add an endpoint that accepts user credentials and, for initial installation, supports the workspace bootstrap flow.
   - Connect with `ldapts`; bind using the service account, search with correctly escaped user input, require an unambiguous match, then bind as the matched user.
   - Require verified TLS according to configuration, apply bounded connection/search timeouts, and avoid logging passwords or LDAP responses containing sensitive attributes.
   - Return generic authentication errors to the client while retaining useful, secret-safe server diagnostics.

4. **Provision and link users safely**
   - Provision a user only after successful LDAP authentication and only when required identity attributes are present and valid.
   - Store a stable LDAP subject identifier for future logins; do not rely only on mutable email addresses.
   - Scope identity links and account lookup to the resolved workspace. Reject collisions with existing unlinked users rather than silently linking by email.
   - Apply the agreed default role and document how an operator promotes an administrator.

5. **Enforce LDAP-only mode server-side**
   - Reject local password login and other interactive SSO login methods while LDAP-only mode is active. Hiding UI controls is not an authorization boundary.
   - Disable password-based setup, signup, forgot-password, and password-reset entry points when enabled, including direct API calls.
   - Preserve session creation, cookie settings, session revocation, audit logging, and applicable MFA policy for LDAP-authenticated users.
   - Keep programmatic API credentials unchanged by default; confirm this policy in task 1.

6. **Update client login and setup flows**
   - Replace the provider-ID LDAP modal path with a deployment-level LDAP login form when LDAP-only mode is active.
   - Ensure local login and other SSO controls are not offered in this mode.
   - Add an LDAP-backed first-workspace setup path that does not grant administrator privileges automatically. Include clear handling for installations with no workspace yet.
   - Retain current login behavior when LDAP mode is disabled. Avoid exposing LDAP server settings or credentials to the browser.

7. **Test, document, and validate deployment behavior**
   - Add focused unit and API tests for config validation, LDAP bind/search, invalid credentials, ambiguous/missing matches, TLS failures, provisioning, identity collisions, workspace isolation, exclusive-mode bypass attempts, sessions, and MFA.
   - Verify existing password login and workspace setup remain unchanged with LDAP disabled.
   - Document environment variables, TLS/CA configuration, first-workspace bootstrap, manual admin promotion, outage behavior, and disabling LDAP mode.
   - Validate both client and server production builds and run relevant tests.

## Acceptance Criteria

- With LDAP disabled, current authentication and setup flows behave as before.
- With LDAP enabled, the UI offers LDAP as the only interactive sign-in method and the server rejects alternate interactive login paths even when called directly.
- Valid LDAP credentials create or retrieve a workspace-scoped user, establish a normal Docmost session, and follow applicable MFA policy.
- First-login provisioning does not claim an existing unlinked local account based on email alone.
- Invalid or incomplete LDAP configuration fails safely; secrets never reach client responses or logs.
- A new installation can complete LDAP-backed workspace bootstrap, granting owner only to the authenticated bootstrap user; subsequent LDAP users are members.
- LDAP identity and provisioning in one workspace cannot grant access to another workspace.

## Estimate

Preliminary estimate: **9–13 engineering days**, including implementation, tests, and documentation. The largest uncertainty is the identity-link schema and the initial workspace/admin bootstrap path. This assumes a core-server implementation and reuse/adaptation of available client UI; it excludes external LDAP infrastructure setup.

## Open Decisions Before Coding

- Confirm exact environment variable names/defaults and CA path handling during implementation; current proposed contract is listed above.
- Choose directory-specific `LDAP_USER_SEARCH_FILTER` and required stable `LDAP_USER_ID_ATTRIBUTE` values for deployment configuration.
