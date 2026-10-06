# LDAP Authentication (Self-Hosted)

LDAP-only authentication is an optional, deployment-wide mode for self-hosted Docmost. It is not supported when `CLOUD=true`. With LDAP mode enabled, LDAP is the only interactive sign-in method; OAuth and API-key credentials remain available.

## Configure

Set these variables in the server environment. The values shown in `.env.example` are examples; replace them for your directory.

| Variable | Required when enabled | Purpose |
|---|---:|---|
| `LDAP_ENABLED` | Yes | Set to `true` to enable LDAP-only interactive sign-in. Defaults to `false`. |
| `LDAP_URL` | Yes | LDAP endpoint, such as `ldaps://directory.example.com:636` or `ldap://directory.example.com:389`. |
| `LDAP_BIND_DN` | Yes | Service-account DN used to search the directory. |
| `LDAP_BIND_PASSWORD` | Yes | Service-account password. Keep it server-side. |
| `LDAP_BASE_DN` | Yes | Search base for user entries. |
| `LDAP_USER_SEARCH_FILTER` | Yes | RFC4515 filter containing `{{username}}`, for example `(uid={{username}})`. |
| `LDAP_USER_ID_ATTRIBUTE` | Yes | Stable, single-valued string attribute identifying the directory user, for example `entryUUID`. |
| `LDAP_USER_EMAIL_ATTRIBUTE` | No | Email attribute; defaults to `mail`. The value is treated as verified. |
| `LDAP_USER_NAME_ATTRIBUTE` | No | Display-name attribute; defaults to `displayName`, with `cn` as fallback. |
| `LDAP_STARTTLS` | No | Set to `true` to upgrade an `ldap://` connection using StartTLS. Defaults to `false`. |
| `LDAP_TLS_CA_CERT_PATH` | No | Optional path to an additional trusted CA certificate, readable by the server process. In containers, mount the certificate at that path. |
| `LDAP_CONNECT_TIMEOUT_MS` | No | TCP connect timeout in milliseconds; defaults to `5000`. |
| `LDAP_SEARCH_TIMEOUT_MS` | No | LDAP operation/search timeout in milliseconds; defaults to `5000`. |

The service account needs permission to search under `LDAP_BASE_DN` and read the configured subject, email, and display-name attributes. It does not need directory write access. User credentials are checked by binding as the matched user.

The filter's `{{username}}` value is escaped before substitution. The search must return exactly one user. Configure the filter and attributes for your directory; there is no universal stable subject attribute across LDAP products. Use an attribute whose value is stable, unique, and returned as text.

## TLS

Use `ldaps://` with `LDAP_STARTTLS=false`, or use `ldap://` with `LDAP_STARTTLS=true`. Do not combine `ldaps://` and StartTLS. LDAP is required to use TLS outside development and test environments. Certificate verification remains enabled; configure `LDAP_TLS_CA_CERT_PATH` for a private CA instead of disabling verification. A missing or unreadable CA file prevents LDAP authentication.

When `LDAP_ENABLED=true`, the server validates the required settings during startup. LDAP mode is rejected when `CLOUD=true`.

## Account Behavior

- The user authenticated during initial LDAP workspace setup becomes the workspace owner. Subsequent first-time LDAP users are provisioned as members.
- LDAP-provisioned users have no local password. Their email is marked verified based on the configured directory attribute.
- A matching existing local email is not automatically linked. Provisioning is rejected and requires explicit operator resolution.
- Identity records are scoped to a workspace and use the stable directory subject, not email, as the identity key.
- LDAP-only mode rejects password login, local setup, password change/reset, password-based invitation acceptance, and other interactive SSO routes at the server.
- Disabling LDAP mode restores the other interactive authentication routes. LDAP-provisioned accounts remain passwordless and need another configured sign-in method or an operator-provided password before they can use password login.

## MFA

Core LDAP login runs the EE MFA integration before issuing a session. An EE build must implement the LDAP MFA hook and create the post-challenge session only after successful verification. If the hook is unavailable or returns an unexpected result, LDAP login fails closed. Workspaces or accounts requiring MFA must not bypass this hook.

## Outage and Recovery

If the directory is unavailable, new LDAP sign-ins and initial setup cannot complete. Existing Docmost sessions continue under the normal session expiry and revocation rules. Restore directory connectivity and TLS trust, then retry sign-in.

To restore other interactive authentication methods, set `LDAP_ENABLED=false` in the server environment and restart the Docmost server/container. Keep the LDAP configuration available for later re-enablement. Do not add a local-password bypass while LDAP-only mode is enabled.

## Verification Record

Record results after the corresponding implementation checks have been run. At the time this guide was added, Phases 7 and 8 were still pending; Jest/build and deployment verification had not been run in this workspace because `pnpm` and workspace-local binaries were unavailable.

- Initial owner/member and concurrent bootstrap checks: pending.
- Security, route-bypass, workspace-isolation, and regression tests: pending.
- Server/client production builds and deployment environment checks: pending.
