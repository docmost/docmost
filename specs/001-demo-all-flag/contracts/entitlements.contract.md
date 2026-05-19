# Contract: `POST /api/workspace/entitlements`

This contract documents how the entitlements endpoint is allowed to behave once the `DEMO_ALL` flag exists. Endpoint, HTTP method, authentication, and response shape are unchanged.

## Endpoint

- **Method**: `POST`
- **Path**: `/api/workspace/entitlements`
- **Auth**: existing `JwtAuthGuard` + `AuthWorkspace`
- **Request body**: none

## Response shape (unchanged)

```json
{
  "cloud": boolean,
  "tier": "free" | "standard" | "business" | "enterprise",
  "features": string[]
}
```

`features` contains values from the `Feature` enum in [`apps/server/src/common/features.ts`](apps/server/src/common/features.ts).

## Behavior matrix

| Mode                          | `cloud`                                  | `tier`                                                    | `features`                                                       |
| ----------------------------- | ---------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| `DEMO_ALL=false` / unset      | from `EnvironmentService.isCloud()`      | `licenseCheckService.resolveTier(licenseKey, plan)`       | `licenseCheckService.resolveFeatures(licenseKey, plan)`          |
| `DEMO_ALL=true`               | from `EnvironmentService.isCloud()`      | `"enterprise"`                                            | every value of `Object.values(Feature)` (no duplicates)          |

### Invariants

- The response is JSON-serializable and matches the existing TypeScript [`Entitlements`](apps/client/src/ee/entitlement/entitlement.types.ts#L3-L7) type in both modes.
- Demo mode does **not** alter the `cloud` field. `CLOUD` and `DEMO_ALL` are orthogonal.
- Demo mode does **not** add fields. Clients with the existing schema continue to deserialize the response without changes.
- Toggling `DEMO_ALL` off and restarting the application returns the response to its pre-flag values without any data migration.

### Acceptance evidence

- Server unit test: `LicenseCheckService` with `DEMO_ALL=true` returns `"enterprise"` from `resolveTier` and a superset of every `Feature.*` value from `resolveFeatures`.
- Manual: with `DEMO_ALL=true`, hitting `POST /api/workspace/entitlements` as a logged-in workspace member returns `tier === "enterprise"` and `features` containing every `Feature.*` value, regardless of the workspace's stored `licenseKey` or `plan`.
- Manual: same call with `DEMO_ALL` unset returns the prior, license-driven values.
