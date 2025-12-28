# Base image with pnpm configured via Corepack
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.4.0 --activate
WORKDIR /app

# Stage 1: Dependency installation
# This stage is heavily cached. It only runs when dependency files change.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches ./patches
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/
COPY packages/editor-ext/package.json ./packages/editor-ext/

# Use BuildKit cache mount for persistent pnpm store and fetch dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Stage 2: Build the application
# This stage uses the node_modules from deps and builds the project
FROM base AS builder
COPY --from=deps /app /app
COPY . .
RUN pnpm build

# Stage 3: Runner stage for a lean production image
FROM base AS runner
LABEL org.opencontainers.image.source="https://github.com/docmost/docmost"

# Install runtime dependencies
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl bash \
  && rm -rf /var/lib/apt/lists/*

# Copy built artifacts and necessary manifests for production install
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/client/dist ./apps/client/dist
COPY --from=builder /app/packages/editor-ext/dist ./packages/editor-ext/dist

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/client/package.json ./apps/client/package.json
COPY --from=builder /app/packages/editor-ext/package.json ./packages/editor-ext/package.json
COPY --from=builder /app/patches ./patches

# Install only production dependencies
# Running as node user for security
RUN chown -R node:node /app
USER node
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# Setup data storage directory
RUN mkdir -p /app/data/storage

VOLUME ["/app/data/storage"]
EXPOSE 3000

CMD ["pnpm", "start"]
