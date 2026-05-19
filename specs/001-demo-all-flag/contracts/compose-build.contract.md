# Contract: `docker-compose.yml` builds the application image

## Pre-change state

[`docker-compose.yml`](docker-compose.yml) pulls a published image:

```yaml
services:
  docmost:
    image: docmost/docmost:latest
```

## Post-change state (shape, not literal YAML)

```yaml
services:
  docmost:
    build:
      context: .
      dockerfile: Dockerfile
    image: docmost/docmost:local
    environment:
      # ... existing env entries unchanged ...
      DEMO_ALL: ${DEMO_ALL:-false}
```

## Required properties

- `services.docmost.build.context` is `.` (repository root).
- `services.docmost.build.dockerfile` is `Dockerfile` (the existing root [`Dockerfile`](Dockerfile)).
- `services.docmost.image` is a local tag (e.g. `docmost/docmost:local`) so successive runs reuse the locally built image and do not silently fall back to a previously pulled `docmost/docmost:latest`.
- `services.docmost.environment.DEMO_ALL` is present with a safe default of `false` and is overridable via shell env or a Compose `.env` file.
- All other services (`db`, `redis`) and their volumes are unchanged.
- All other docmost-service settings (`depends_on`, `ports`, `volumes`, `restart`) are unchanged.

## Build invariants

- `docker compose build` from a clean checkout MUST succeed without secret files or additional flags. The existing [`.dockerignore`](.dockerignore) excludes `node_modules`, `.git`, `dist`, `/data`, `.env*`, and `.nx`, which the build relies on.
- The build's output image MUST reflect the current working-tree application source. A trivial change in `apps/client/src` or `apps/server/src` MUST be visible in the running container after a rebuild.

## Acceptance evidence

- `docker compose build` exits 0 from a clean checkout.
- `docker compose up` runs the locally built image; logs show a build phase, not just an image pull.
- Setting `DEMO_ALL=true` in the shell, running `docker compose up`, and hitting `/api/workspace/entitlements` returns `tier: "enterprise"` and the full feature list.
- Unsetting `DEMO_ALL` and restarting reverts to the previous entitlements values.
