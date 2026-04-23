FROM node:22-slim AS base
LABEL org.opencontainers.image.source="https://github.com/docmost/docmost"

RUN npm install -g pnpm@10.4.0

FROM base AS builder

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm --filter server deploy --prod --legacy --no-optional /app/runtime
RUN cp -R /app/apps/server/dist /app/runtime/dist \
    && rm -rf /app/runtime/src /app/runtime/test \
    && rm -f /app/runtime/.dockerignore /app/runtime/.prettierrc /app/runtime/eslint.config.mjs /app/runtime/nest-cli.json /app/runtime/README.md /app/runtime/tsconfig.build.json /app/runtime/tsconfig.json \
    && rm -rf /app/runtime/node_modules/@docmost/editor-ext/src \
    && rm -rf /app/runtime/node_modules/@docmost/editor-ext/node_modules \
    && rm -f /app/runtime/node_modules/@docmost/editor-ext/.prettierrc /app/runtime/node_modules/@docmost/editor-ext/README.md /app/runtime/node_modules/@docmost/editor-ext/tsconfig.json

FROM base AS installer

WORKDIR /app

COPY --from=builder --chown=node:node /app/runtime/ /app/
COPY --from=builder --chown=node:node /app/apps/client/dist /app/apps/client/dist

RUN mkdir -p /app/data/storage

VOLUME ["/app/data/storage"]

EXPOSE 3000

USER node

CMD ["node", "dist/main"]
