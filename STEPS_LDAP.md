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

## 2. Phase 2 Implementation Complete: Server-Side LDAP Configuration

- [x] Add typed settings in the server `EnvironmentService` for `LDAP_ENABLED`, URL, bind DN/password, base DN, search filter, attribute mappings, TLS/CA, and timeouts.
- [x] Validate required settings at startup when LDAP is enabled; fail safely on invalid or incomplete configuration.
- [x] Reject `LDAP_ENABLED=true` with `CLOUD=true` so LDAP-only behavior cannot partially alter Cloud authentication.
- [x] Ensure secrets are not returned by the auth-mode response or written by validation to logs.
- [x] Expose only a non-secret LDAP-only-mode status to the client through `/api/auth/mode`, including before workspace setup.
- [x] Confirm Docker Compose passes the new environment variables to the server.
- [x] Verify LDAP-disabled defaults in the getter and validation tests.

**Verification pending:** Environment-validation and service/controller Jest tests were added, but could not be run because `pnpm` and workspace-local Jest binaries are unavailable. Editor diagnostics report no errors. (0.75-1 day)

## 3. Phase 3 Implementation Complete: LDAP Connectivity and Credential Verification

- [x] Add an injectable LDAP service in the core server using the existing `ldapts` dependency.
- [x] Connect with the configured service account and search for the supplied login identifier.
- [x] Escape user-provided values before inserting them into LDAP filters; require exactly one matching entry.
- [x] Bind as the matched user to verify credentials.
- [x] Enforce verified TLS according to configuration and use bounded connect/search timeouts.
- [x] Close LDAP clients/connections on success and failure paths.
- [x] Return generic login errors to the client while logging only secret-safe diagnostic context.

**Verification pending:** Focused LDAP service Jest tests were added, but cannot be run because `pnpm` and workspace-local Jest binaries are unavailable. Editor diagnostics report no errors. (1.5-2 days)

## 4. Phase 4 Implementation Complete: Persist Identity and Provision Users

- [x] Add the dedicated LDAP identity table with stable subject ID, workspace and user references, and unique workspace-scoped subject/user constraints.
- [x] After successful LDAP verification, look up the identity link within the resolved workspace.
- [x] If no link exists, validate identity attributes from the LDAP service and create a passwordless Docmost member.
- [x] Mark the LDAP-provided email as verified on account creation.
- [x] Reject provisioning if the email collides with an existing unlinked local account; do not auto-link by email.
- [x] Store the stable directory subject identifier for subsequent logins; do not use mutable email as the sole identity key.
- [x] Update user insertion and password login/change-password to handle `password = null` safely.
- [x] Add a forward/down migration and update Kysely database/entity types.
- [x] Scope identity lookup and provisioning to the requested workspace.

**Verification pending:** Focused signup and provisioning tests were added but could not be run because `pnpm` and workspace-local Jest binaries are unavailable. The Kysely types were updated manually; code generation and database-backed concurrent provisioning verification remain pending. (1-2 days)

## 5. Phase 5 Implementation Complete: Login and LDAP-Only Enforcement

- [x] Add a core-server LDAP login endpoint for normal workspace login.
- [x] Add an LDAP-backed initial workspace setup endpoint; the authenticated setup user becomes owner.
- [x] Make initial workspace/user/identity creation transactional and concurrency-safe.
- [x] On successful authentication, use the existing session service to create a persisted session and access JWT, then set the standard HttpOnly `authToken` cookie.
- [x] Add an EE MFA hook before session issuance; reject login if EE is loaded but does not implement the hook, and fail closed when MFA is enforced but unavailable.
- [x] When LDAP-only mode is enabled, reject direct password login/setup/change/reset routes, password-based invitation acceptance, and EE SSO routes.
- [x] Enforce auth mode on the server, not only by hiding UI controls.
- [x] Keep OAuth and API-key credentials unchanged.

**Verification pending:** Controller tests were added but could not be run because `pnpm` and workspace-local Jest binaries are unavailable. The EE MFA hook must be implemented before LDAP can be used with an EE MFA build; its verifier must issue the post-challenge session and call `AuthService.recordSuccessfulLdapLogin` only after MFA succeeds. Until then, LDAP login fails closed in that build. Editor diagnostics report no errors. (1-1.5 days)

## 6. Phase 6 Implementation Complete: Client Login and Bootstrap UI

- [x] Use the server-reported non-secret auth mode to decide which sign-in UI to render; fail closed if mode lookup fails.
- [x] Replace the provider-ID LDAP modal path in LDAP-only mode with a deployment-level LDAP login form; no LDAP configuration or secrets are sent to the browser.
- [x] Hide local password, SSO, invitation-password, forgot-password, and reset-password controls while LDAP-only mode is enabled.
- [x] Add LDAP credentials to initial workspace setup; the authenticated bootstrap user becomes owner through the server flow.
- [x] Keep the existing password/SSO and Cloud setup experiences unchanged when LDAP is disabled.
- [x] Handle login/setup failures with user-facing errors and loading states.

**Verification pending:** Editor diagnostics found no errors. Client tests and production build were not run because `pnpm` and workspace-local binaries are unavailable; this client has no existing auth-component test harness. (0.75-1.25 days)

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
