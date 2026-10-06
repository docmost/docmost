# LDAP Feature Implementation Steps

Use this as the execution checklist for the LDAP-only authentication feature described in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Estimates are preliminary engineering days and assume core-server implementation because `apps/server/src/ee` is unavailable.

## 1. Phase 1 Complete: Design Decisions

- [x] LDAP-only mode is supported for self-hosted deployments only; reject `LDAP_ENABLED=true` when `CLOUD=true`.
- [x] LDAP configuration is deployment-wide and environment-based, not managed through per-workspace provider settings.
- [x] LDAP is the only interactive login when enabled. OAuth and API-key credentials remain available.
- [x] Provision accounts on first successful LDAP login; reject matching unlinked local accounts instead of auto-linking by email.
- [x] Use a dedicated identity table with a unique `(workspace_id, stable_subject_id)` key; the existing `auth_accounts` uniqueness does not protect external subjects.
- [x] Treat the configured LDAP email attribute as verified for newly provisioned LDAP users.
- [x] The authenticated user completing initial LDAP-backed workspace setup becomes owner. Later LDAP-provisioned users are members.
- [x] LDAP users have no local password; server password insertion/login paths must handle null passwords safely.
- [x] Keep the login filter and user attributes configurable. Proposed variable names and defaults are in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

Directory-specific search-filter and stable-subject attribute values are supplied by each deployment. No implementation work is included in this design phase.

## 2. Add Server-Side LDAP Configuration

- [ ] Add typed settings in the server `EnvironmentService` for `LDAP_ENABLED`, URL, bind DN/password, base DN, search filter, attribute mappings, TLS/CA, and timeouts.
- [ ] Validate required settings at startup when LDAP is enabled; fail safely on invalid or incomplete configuration.
- [ ] Reject `LDAP_ENABLED=true` with `CLOUD=true` so LDAP-only behavior cannot partially alter Cloud authentication.
- [ ] Ensure secrets are not returned by configuration endpoints or written to logs.
- [ ] Expose only a non-secret LDAP-only-mode status to the client from server runtime configuration.
- [ ] Confirm Docker/Compose and supported self-hosted deployment configurations pass the new environment variables to the server.
- [ ] Verify LDAP-disabled defaults preserve current behavior.

**Verification:** Add configuration tests for disabled mode, valid enabled mode, Cloud conflict, missing settings, invalid URLs, and TLS configuration. (0.75-1 day)

## 3. Implement LDAP Connectivity and Credential Verification

- [ ] Add an injectable LDAP service in the core server using the existing `ldapts` dependency.
- [ ] Connect with the configured service account and search for the supplied login identifier.
- [ ] Escape user-provided values before inserting them into LDAP filters; require exactly one matching entry.
- [ ] Bind as the matched user to verify credentials.
- [ ] Enforce verified TLS according to configuration and use bounded connect/search timeouts.
- [ ] Close LDAP clients/connections on success and failure paths.
- [ ] Return generic login errors to the client while logging only secret-safe diagnostic context.

**Verification:** Unit-test invalid credentials, no result, multiple results, LDAP unavailability, timeouts, filter escaping, TLS errors, and connection cleanup. (1.5-2 days)

## 4. Persist Identity and Provision Users

- [ ] Add the dedicated LDAP identity table with a stable subject ID, workspace and user references, and uniqueness constraints decided in Phase 1.
- [ ] After successful LDAP verification, look up the identity link within the resolved workspace.
- [ ] If no link exists, validate required LDAP attributes and create a passwordless Docmost user.
- [ ] Mark the LDAP-provided email as verified on account creation.
- [ ] Reject provisioning if the email collides with an existing unlinked local account; do not auto-link by email.
- [ ] Store the stable directory subject identifier for subsequent logins; do not use mutable email as the sole identity key.
- [ ] Update user insertion and password login to handle `password = null` safely.
- [ ] Add a forward/down migration and regenerate database types.
- [ ] Confirm the same LDAP identity cannot resolve to a user in another workspace.

**Verification:** Test first-login provisioning, repeat login, required attributes, email collision, concurrent first login, disabled users, passwordless login rejection, and workspace isolation. (1-2 days)

## 5. Add Login and Enforce LDAP-Only Mode

- [ ] Add a core-server LDAP login endpoint for normal workspace login.
- [ ] Add or adapt an LDAP-backed initial workspace setup endpoint/flow that can operate before a workspace exists; the authenticated setup user becomes owner.
- [ ] Make initial workspace/user/identity creation transactional and concurrency-safe.
- [ ] On successful authentication, use the existing session service to create a persisted session and access JWT, then set the standard HttpOnly `authToken` cookie.
- [ ] Preserve applicable MFA policy, session revocation behavior, throttling, and audit events.
- [ ] When LDAP-only mode is enabled, reject direct requests to password login, other interactive SSO login routes, password setup/signup, forgot-password, and password-reset routes.
- [ ] Make sure UI hiding is not the only enforcement; test server endpoint rejection directly.
- [ ] Keep OAuth and API-key credentials unchanged.

**Verification:** API tests cover successful login/session issuance, direct alternate-login bypass attempts, setup behavior, MFA, Cloud-mode rejection, and LDAP-disabled compatibility. (1-1.5 days)

## 6. Update Client Login and Bootstrap UI

- [ ] Use the server-reported non-secret auth mode to decide which sign-in UI to render.
- [ ] Replace the existing provider-ID LDAP modal flow with a deployment-level LDAP login form; no provider ID or LDAP secrets should be required in the browser.
- [ ] Hide password and other interactive provider controls while LDAP-only mode is enabled.
- [ ] Add the LDAP credential step to initial workspace setup. The authenticated bootstrap user becomes owner; subsequent users do not receive elevated roles.
- [ ] Keep the existing password/SSO experience unchanged when LDAP is disabled.
- [ ] Handle LDAP failures with useful generic messages and preserve loading/accessibility behavior.

**Verification:** Client tests cover mode-specific rendering, login request, bootstrap flow, error states, and no regression with LDAP disabled. (0.75-1.25 days)

## 7. Verify Initial Owner Bootstrap

- [ ] Ensure only the authenticated user completing initial workspace setup receives owner privileges.
- [ ] Ensure normal first-login provisioning always creates a member, including under concurrent login attempts.
- [ ] Test initial owner creation and repeated setup rejection.

(Included in bootstrap implementation and verification.)

## 8. Complete Security, Regression, and Deployment Checks

- [ ] Verify credentials and LDAP attributes are not exposed in API responses, browser bundles, logs, or error messages.
- [ ] Test alternate interactive auth routes while LDAP-only mode is enabled, including routes not visible in the UI.
- [ ] Verify OAuth/API-key authentication remains available as designed.
- [ ] Test user/session behavior across workspaces and verify one workspace cannot reuse another workspace's identity link.
- [ ] Verify existing login, setup, password reset, and SSO behavior with LDAP disabled.
- [ ] Run relevant server and client unit/API tests.
- [ ] Run `pnpm server:build` and `pnpm client:build`.
- [ ] Test container/deployment environment propagation and startup failure messages for invalid LDAP configuration.

(1.5-2.5 days)

## 9. Document Operations

- [ ] Add the LDAP environment section to `.env.example` with safe placeholders and comments.
- [ ] Document required LDAP permissions, search filter syntax, attribute mappings, TLS/CA setup, and timeouts.
- [ ] Document enabling/disabling LDAP-only mode, initial workspace bootstrap/owner assignment, outage behavior, and recovery.
- [ ] State explicitly that disabling LDAP mode restores the existing interactive authentication options.

(0.5-1 day)

## Completion Criteria

- [ ] LDAP disabled: existing auth and setup work as before.
- [ ] LDAP enabled: LDAP is the only interactive login method for self-hosted deployments; alternate interactive endpoints reject direct calls.
- [ ] `CLOUD=true` plus LDAP enabled fails clearly at startup.
- [ ] Valid LDAP login provisions or retrieves a workspace-scoped account and creates a normal Docmost session.
- [ ] Existing unlinked accounts are never silently claimed based on email.
- [ ] Only the authenticated initial workspace bootstrap user receives owner privileges; subsequent LDAP users are members.
- [ ] OAuth/API-key credentials remain available.
- [ ] Configuration and directory failures fail safely without leaking secrets.
- [ ] Relevant tests and both production builds pass.

## Estimate

Preliminary total: **9-13 engineering days**, including tests and documentation. This excludes LDAP infrastructure provisioning and may change after the identity-link and bootstrap decisions are implemented and validated.
