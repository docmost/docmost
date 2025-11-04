FROM node:22-alpine AS base
LABEL org.opencontainers.image.source="https://github.com/vito0912/forkmost"

FROM base AS builder

WORKDIR /app

# Copy dependency files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches

# Copy package.json files from all workspaces
COPY apps/server/package.json ./apps/server/package.json
COPY apps/client/package.json ./apps/client/package.json
COPY packages/editor-ext/package.json ./packages/editor-ext/package.json

ENV NX_SOCKET_DIR=/tmp/nx-tmp

# Install dependencies (this layer will be cached unless dependencies change)
RUN npm install -g pnpm@10.4.0
RUN pnpm install --frozen-lockfile

# Copy source code after dependencies are installed
COPY . .

# Build the project
RUN pnpm build

FROM base AS installer

RUN apk add --no-cache curl bash

WORKDIR /app

# Copy apps
COPY --from=builder /app/apps/server/dist /app/apps/server/dist
COPY --from=builder /app/apps/client/dist /app/apps/client/dist
COPY --from=builder /app/apps/server/package.json /app/apps/server/package.json

# Copy packages
COPY --from=builder /app/packages/editor-ext/dist /app/packages/editor-ext/dist
COPY --from=builder /app/packages/editor-ext/package.json /app/packages/editor-ext/package.json

# Copy root package files
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm*.yaml /app/

# Copy patches
COPY --from=builder /app/patches /app/patches

RUN npm install -g pnpm@10.4.0

RUN chown -R node:node /app

USER node

RUN pnpm install --frozen-lockfile --prod

RUN mkdir -p /app/data/storage

VOLUME ["/app/data/storage"]

EXPOSE 3000

CMD ["pnpm", "start"]
