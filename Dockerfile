FROM node:22-slim AS base
LABEL org.opencontainers.image.source="https://github.com/docmost/docmost"
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.4.0 --activate
WORKDIR /app

RUN npm install -g pnpm@10.4.0

FROM base AS builder

COPY .npmrc package.json pnpm*.yaml nx.json /app/
COPY apps/client/package.json /app/apps/client/package.json
COPY apps/server/package.json /app/apps/server/package.json
COPY packages/editor-ext/package.json /app/packages/editor-ext/package.json

COPY patches /app/patches

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM base AS installer

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl bash \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/data/storage && chown -R node:node /app

# Copy root package files
COPY --chown=node:node --from=builder /app/package.json /app/package.json
COPY --chown=node:node --from=builder /app/pnpm*.yaml /app/

# Copy patches
COPY --chown=node:node --from=builder /app/patches /app/patches

# Copy apps
COPY --chown=node:node --from=builder /app/apps/server/dist /app/apps/server/dist
COPY --chown=node:node --from=builder /app/apps/client/dist /app/apps/client/dist
COPY --chown=node:node --from=builder /app/apps/server/package.json /app/apps/server/package.json

# Copy packages
COPY --chown=node:node --from=builder /app/packages/editor-ext/dist /app/packages/editor-ext/dist
COPY --chown=node:node --from=builder /app/packages/editor-ext/package.json /app/packages/editor-ext/package.json

USER node

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

VOLUME ["/app/data/storage"]

EXPOSE 3000

CMD ["pnpm", "start"]
