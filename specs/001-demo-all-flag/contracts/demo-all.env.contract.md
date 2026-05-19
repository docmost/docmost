# Contract: `DEMO_ALL` environment variable

## Name & casing

- Canonical name: `DEMO_ALL` (uppercase).
- The application MUST NOT honor case variants (`Demo_All`, `demo_all`).

## Type & parsing

- Logical type: `boolean`.
- Parsed by comparing the trimmed, lowercased string value to the literal `"true"`. Anything else (unset, empty, `"false"`, `"1"`, `"yes"`, garbage) resolves to `false`.
- Parser must reuse the same idiom as `EnvironmentService.isCloud()` / `isDisableTelemetry()` / `isCollabDisableRedis()` so behavior is consistent with every existing boolean toggle.

## Default

- `false` when unset, when empty, when malformed.

## Effect when `true`

1. Every public method of `LicenseCheckService` short-circuits to its "all features, highest tier" answer **before** any attempt to load the EE license module.
2. The `/api/workspace/entitlements` response reports `tier: "enterprise"` and `features: Object.values(Feature)`.
3. The application emits one operator-visible `WARN`-level log line on startup whose message contains the literal substring `DEMO_ALL=true` and a "do not use in production" warning.

## Effect when `false` or unset

- No behavior change. Every method on `LicenseCheckService` runs its existing logic. `/api/workspace/entitlements` returns its current, license-driven values.

## Non-effects (explicit)

- Does **not** change cloud-vs-self-hosted routing (`CLOUD` is still the sole driver).
- Does **not** auto-configure or mock AI providers, SAML IdPs, S3, or SMTP.
- Does **not** write to any database table.
- Does **not** create new background jobs or sockets.
- Does **not** affect `packages/editor-ext`.

## Surface placement

- Read accessor: `isDemoAll()` on [`EnvironmentService`](apps/server/src/integrations/environment/environment.service.ts), colocated with peer boolean toggles.
- Override behavior: at the top of every public method on [`LicenseCheckService`](apps/server/src/integrations/environment/license-check.service.ts), consulting `EnvironmentService` via the existing injected dependency.
- Startup log: one `Logger.warn(...)` call from the application bootstrap path (see Phase 0 R5).
- Compose exposure: `DEMO_ALL: ${DEMO_ALL:-false}` in the `environment:` block of [`docker-compose.yml`](docker-compose.yml).
- Documentation: appended to [`.env.example`](.env.example) under a "Demo mode (do not use in production)" comment.
