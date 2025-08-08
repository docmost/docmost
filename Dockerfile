FROM node:22-alpine AS base
LABEL org.opencontainers.image.source="https://github.com/docmost/docmost"

FROM base AS builder

WORKDIR /app

COPY . .

RUN npm install -g pnpm@10.4.0
RUN pnpm install --frozen-lockfile
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
RUN pnpm install --frozen-lockfile --prod
RUN mkdir -p /app/data/storage

VOLUME ["/app/data/storage"]

COPY ./entrypoint.sh /app/run.sh
RUN chown -R node:node /app && \
    find /app -type d -exec chmod 770 {} + && \
    find /app -type f -exec chmod 660 {} + && \
    find /app/node_modules/.bin/ -type f -exec chmod 770 {} + && \
    chmod +x /app/run.sh

EXPOSE 3000

ENTRYPOINT ["/app/run.sh"]


#CMD ["pnpm", "start"]
