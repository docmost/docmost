FROM node:26-slim AS base

RUN npm install -g pnpm@12.16.1 && npm cache clean --force

FROM base AS builder

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN NX_DAEMON=false pnpm build

FROM base AS installer

WORKDIR /app

# Copy apps
COPY --from=builder /app/apps/server/dist /app/apps/server/dist
COPY --from=builder /app/apps/client/dist /app/apps/client/dist
COPY --from=builder /app/apps/client/package.json /app/apps/client/package.json
COPY --from=builder /app/apps/server/package.json /app/apps/server/package.json

# Copy packages
COPY --from=builder /app/packages/editor-ext/dist /app/packages/editor-ext/dist
COPY --from=builder /app/packages/editor-ext/package.json /app/packages/editor-ext/package.json
COPY --from=builder /app/packages/base-formula/dist /app/packages/base-formula/dist
COPY --from=builder /app/packages/base-formula/package.json /app/packages/base-formula/package.json

# Copy root package files
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm*.yaml /app/

# Copy patches
COPY --from=builder /app/patches /app/patches

# client package.json is only copied for the lockfile check; its deps are bundled in dist
RUN pnpm install --frozen-lockfile --prod --filter '!./apps/client'
RUN find /app/node_modules/.pnpm -type f \( -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' -o -name '*.d.ts.map' -o -name '*.d.mts.map' -o -name '*.d.cts.map' \) -delete

RUN mkdir -p /app/data/storage

# pnpm, its store and its caches stay behind in the installer stage
FROM node:26-slim
LABEL org.opencontainers.image.source="https://github.com/docmost/docmost"

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl bash \
  && rm -rf /var/lib/apt/lists/*

# drop npm and corepack
RUN rm -rf /usr/local/lib/node_modules/npm \
  && rm -rf /usr/local/lib/node_modules/corepack \
  && rm -rf /usr/local/bin/npm \
  && rm -rf /usr/local/bin/npx \
  && rm -rf /usr/local/bin/corepack \
  && rm -rf /root/.npm \
  && rm -rf /root/.node-gyp

COPY --from=installer --chown=node:node /app /app

WORKDIR /app/apps/server

ENV NODE_ENV=production
ENV NODE_OPTIONS=--no-webstorage

USER node

VOLUME ["/app/data/storage"]

EXPOSE 3000

CMD ["node", "dist/main"]
