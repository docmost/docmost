FROM node:22-slim AS base
LABEL org.opencontainers.image.source="https://github.com/docmost/docmost"

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.4.0

FROM base AS builder

WORKDIR /app

# Copy configuration files first for better layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/
COPY packages/editor-ext/package.json ./packages/editor-ext/
COPY patches ./patches

# Install dependencies using cache mount for pnpm store
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build applications using cache mount for nx
RUN --mount=type=cache,id=nx,target=/app/.nx/cache pnpm build

FROM base AS installer

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl bash \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/client/dist ./apps/client/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json

# Copy package artifacts
COPY --from=builder /app/packages/editor-ext/dist ./packages/editor-ext/dist
COPY --from=builder /app/packages/editor-ext/package.json ./packages/editor-ext/package.json

# Copy root configurations and patches
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=builder /app/patches ./patches

# Install production dependencies only
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

RUN mkdir -p /app/data/storage
VOLUME ["/app/data/storage"]

EXPOSE 3000

CMD ["pnpm", "start"]
