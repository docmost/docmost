# Quickstart: Demo mode + Compose build

This quickstart shows an operator or reviewer how to (a) build the project via Docker Compose from a fresh checkout and (b) flip on demo mode to unlock every gated feature.

> **Warning** — `DEMO_ALL=true` bypasses paid-feature and license gating. It is a demo / evaluation flag. Do not set it in production environments.

## Prerequisites

- Docker Desktop or any Docker engine + Compose v2.
- A clone of this repository at the desired commit.

## 1. Run the stack from a local build (no demo mode)

This is the new default for `docker-compose.yml`: the application image is built from the working tree, not pulled.

```sh
docker compose up --build
```

You should see Docker's BuildKit output for the `docmost` service (BuildKit step lines from the [`Dockerfile`](../../Dockerfile)) before the container starts. Once running, open <http://localhost:3000>.

Behavior at this point matches a stock Docmost build: gated/EE features remain hidden because no license key is set.

## 2. Verify the running image reflects the working tree

In a second shell:

```sh
echo "test marker $(date +%s)" >> apps/client/src/App.tsx
docker compose up --build -d
# Then load the app and confirm the working-tree change is observable.
```

Roll back the test marker afterwards.

## 3. Enable demo mode

Stop the stack, then either edit `docker-compose.yml` to set `DEMO_ALL: "true"` directly, or use a shell env or `.env` file picked up by Compose:

```sh
# Option A: ad-hoc shell env
DEMO_ALL=true docker compose up --build

# Option B: persistent local override via .env at the repo root
echo 'DEMO_ALL=true' >> .env
docker compose up --build
```

On boot, the server emits a single `WARN` log line containing `DEMO_ALL=true` and a "do not use in production" message.

## 4. Confirm gated features are unlocked

Log in to the workspace at <http://localhost:3000>. Then verify:

1. **API check**:

   ```sh
   curl -X POST http://localhost:3000/api/workspace/entitlements \
     -H "Cookie: <copy from your browser session>"
   ```

   Response should report `"tier": "enterprise"` and a `"features"` array containing every value of the `Feature` enum (SSO, SCIM, MFA, API keys, page permissions, AI, MCP, audit logs, retention, sharing controls, viewer comments, templates, PDF export, etc.).

2. **UI check**: navigate to the workspace admin area. EE-only sections (security settings, SSO, SCIM, audit, etc.) MUST be reachable and interactive, even without a configured license key.

3. **Third-party features**: pages for AI, SAML, S3, and SMTP are reachable but their runtime behavior still depends on real credentials being configured. This is intentional — demo mode unlocks UI access but does not auto-provision external integrations.

## 5. Turn demo mode back off

Either remove `DEMO_ALL` from your environment or set it to `false`, then restart the stack:

```sh
DEMO_ALL=false docker compose up --build -d
```

The entitlements endpoint should immediately return the prior tier/feature list (typically `tier: "free"` with `features: []` in an unlicensed self-hosted build). No database changes; no migrations.

## Troubleshooting

- **Compose still pulls `docmost/docmost:latest`**: ensure you ran `docker compose up --build` (or `docker compose build` first). If a stale image is cached locally, run `docker image rm docmost/docmost:latest` or `docker compose up --build --force-recreate`.
- **Build fails with permission errors**: confirm no host-level files under `apps/`, `packages/`, or the repo root are owned by root from a prior container run; clean up if needed.
- **`DEMO_ALL=true` did not take effect**: confirm the value was passed into the container with `docker compose exec docmost printenv DEMO_ALL`. Confirm the startup `WARN` log line appeared.

## Validation commands

Server unit tests covering the new short-circuit behavior:

```sh
pnpm --filter ./apps/server test -- src/integrations/environment/license-check.service.spec.ts
```

Broader sanity checks if other changes are made:

```sh
pnpm --filter ./apps/server lint
pnpm --filter ./apps/server test
pnpm --filter ./apps/client lint
pnpm --filter ./apps/client test
```
