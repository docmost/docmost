# LDAP Feature Implementation Steps

Use this as the execution checklist for the LDAP-only authentication feature described in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Estimates are preliminary engineering days and assume core-server implementation because `apps/server/src/ee` is unavailable.

## 1. Resolve Design Decisions


**Gate:** Do not start implementation until the identity-link representation and bootstrap/admin process are specified. (0.5–1 day)
## 1. Phase 1 Complete: Design Decisions

- [x] LDAP-only mode is supported for self-hosted deployments only; reject `LDAP_ENABLED=true` when `CLOUD=true`.
- [x] LDAP configuration is deployment-wide and environment-based, not managed through per-workspace provider settings.
- [x] LDAP is the only interactive login when enabled. OAuth and API-key credentials remain available.
## 2. Add Server-Side LDAP Configuration

- [ ] Add typed settings for `LDAP_ENABLED`, server URL, bind DN/password, base DN, search filter, attribute mappings, TLS/CA, and timeouts.
 - [ ] Implement the identity-link schema/strategy chosen in step 1, including workspace scoping and uniqueness for stable LDAP subject IDs.
 - [ ] After successful LDAP verification, look up the identity link within the resolved workspace.
 - [ ] If no link exists, validate required LDAP attributes and create a Docmost user; initial workspace bootstrap assigns owner only to its authenticated user, while later provisioning assigns member.
 - [ ] Reject provisioning if the email collides with an existing unlinked local account; do not auto-link by email.
 - [ ] Store the stable directory subject identifier for subsequent logins; do not use mutable email as the sole identity key.
 - [ ] Add a forward/down migration and regenerate database types if the existing schema cannot safely represent the relationship.
 - [ ] Confirm the same LDAP identity cannot resolve to a user in another workspace.
- [ ] Ensure secrets are not returned by configuration endpoints or written to logs.
- [ ] Expose only a non-secret LDAP-only-mode status to the client from a server-owned runtime setting.
- [ ] Confirm Docker/Compose and supported deployment configurations pass the new environment variables to the server.
 - [ ] Add a core-server LDAP login endpoint for normal workspace login.
 - [ ] Add or adapt an LDAP-backed initial workspace setup endpoint/flow that can operate before a workspace exists; the authenticated setup user becomes owner.
 - [ ] On successful authentication, use the existing session service to create a persisted session and access JWT, then set the standard HttpOnly `authToken` cookie.
 - [ ] Preserve applicable MFA policy, session revocation behavior, throttling, and audit events.
 - [ ] When LDAP-only mode is enabled, reject direct requests to password login, other interactive SSO login routes, password setup/signup, forgot-password, and password-reset routes.
 - [ ] Make sure UI hiding is not the only enforcement; test server endpoint rejection directly.
 - [ ] Keep programmatic API credentials unchanged unless step 1 explicitly decides otherwise.

**Verification:** Add configuration tests for disabled mode, valid enabled mode, missing settings, invalid URLs, and TLS configuration. (0.75–1 day)

 - [ ] Use the server-reported non-secret auth mode to decide which sign-in UI to render.
 - [ ] Replace the existing provider-ID LDAP modal flow with a deployment-level LDAP login form; no provider ID or LDAP secrets should be required in the browser.
 - [ ] Hide password and other interactive provider controls while LDAP-only mode is enabled.
 - [ ] Add the LDAP credential step to initial workspace setup. The authenticated bootstrap user becomes owner; subsequent users do not receive elevated roles.
 - [ ] Keep the existing password/SSO experience unchanged when LDAP is disabled.
 - [ ] Handle LDAP failures with useful, generic messages and preserve loading/accessibility behavior.

- [ ] Add an injectable LDAP service in the core server using the existing `ldapts` dependency.
- [ ] Connect with the configured service account and search for the supplied login identifier.
 - [ ] Document enabling/disabling LDAP-only mode, initial workspace bootstrap/owner assignment, outage behavior, and recovery.
- [ ] Bind as the matched user to verify credentials.
- [ ] Enforce verified TLS according to configuration and use bounded connect/search timeouts.
- [ ] Close LDAP clients/connections on success and failure paths.
 - [ ] LDAP account provisioning does not grant administrator privileges; the documented operator promotion path works.
 - [ ] Only the authenticated initial workspace bootstrap user receives owner privileges; subsequent LDAP users are members.
- [ ] If no link exists, validate required LDAP attributes and create a Docmost user; initial workspace bootstrap assigns owner only to its authenticated user, while later provisioning assigns member.

**Verification:** Test first-login provisioning, repeat login, required attributes, email collision, concurrent first login, disabled users, and workspace isolation. (1–2 days)

## 5. Add Login and Enforce LDAP-Only Mode


- [ ] Add or adapt an LDAP-backed initial workspace setup endpoint/flow that can operate before a workspace exists; the authenticated setup user becomes owner.

**Verification:** API tests cover successful login/session issuance, direct alternate-login bypass attempts, setup behavior, MFA, and LDAP-disabled compatibility. (1–1.5 days)

## 6. Update Client Login and Bootstrap UI


- [ ] Add the LDAP credential step to initial workspace setup. The authenticated bootstrap user becomes owner; subsequent users do not receive elevated roles.

**Verification:** Client tests cover mode-specific rendering, login request, error states, and no regression with LDAP disabled. (0.75–1.25 days)

## 7. Implement and Document Administrator Promotion


## 7. Verify Initial Owner Bootstrap

- [ ] Ensure only the authenticated user completing initial workspace setup receives owner privileges.
- [ ] Ensure normal first-login provisioning always creates a member, including under concurrent login attempts.
- [ ] Test initial owner creation, repeated setup rejection, and concurrent bootstrap attempts.

(Included in bootstrap implementation and verification.)

## 8. Complete Security, Regression, and Deployment Checks

- [ ] Verify credentials and LDAP attributes are not exposed in API responses, browser bundles, logs, or error messages.
- [ ] Test alternate interactive auth routes while LDAP-only mode is enabled, including routes not visible in the UI.
- [ ] Test user/session behavior across workspaces and verify one workspace cannot reuse another workspace's identity link.
- [ ] Verify existing login, setup, password reset, and SSO behavior with LDAP disabled.
- [ ] Run relevant server and client unit/API tests.
- [ ] Run `pnpm server:build` and `pnpm client:build`.
- [ ] Test container/deployment environment propagation and startup failure messages for invalid LDAP configuration.

(1.5–2.5 days)

## 9. Document Operations

- [ ] Add the LDAP environment section to `.env.example` with safe placeholders and comments.
- [ ] Document required LDAP permissions, search filter syntax, attribute mappings, TLS/CA setup, and timeouts.
- [ ] Document enabling/disabling LDAP-only mode, initial workspace bootstrap, manual administrator promotion, outage behavior, and recovery.
- [ ] State explicitly that disabling LDAP mode restores the existing interactive authentication options.

(0.5–1 day)

## Completion Criteria


- [ ] LDAP account provisioning does not grant administrator privileges; the documented operator promotion path works.
- [ ] Only the authenticated initial workspace bootstrap user receives owner privileges; subsequent LDAP users are members.

## Estimate

Preliminary total: **9–13 engineering days**, including tests and documentation. This excludes LDAP infrastructure provisioning and may change after the identity-link and bootstrap decisions are resolved.
