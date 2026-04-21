FROM node:22-slim AS base
LABEL org.opencontainers.image.source="https://github.com/docmost/docmost"

RUN corepack enable && corepack prepare pnpm@10.4.0 --activate

FROM base AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY apps/client/package.json ./apps/client/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/editor-ext/package.json ./packages/editor-ext/package.json

RUN pnpm fetch

COPY . .

RUN pnpm install --offline --frozen-lockfile --force
RUN pnpm build
RUN pnpm --filter server deploy --prod --legacy --no-optional /app/runtime
RUN cp -R /app/apps/server/dist /app/runtime/dist \
    && mkdir -p /app/runtime/apps/server \
    && cp -R /app/apps/server/dist /app/runtime/apps/server/dist \
    && mkdir -p /app/runtime/data/storage \
    && node -e "const fs=require('node:fs'); const pkg=require('/app/package.json'); fs.writeFileSync('/app/runtime/package.json', JSON.stringify({version: pkg.version}, null, 2));" \
    && node -e "const fs=require('node:fs'); fs.mkdirSync('/app/runtime/apps/server',{recursive:true}); fs.copyFileSync('/app/runtime/package.json','/app/runtime/apps/server/package.json');" \
    && rm -rf /app/runtime/src /app/runtime/test \
    && rm -rf /app/runtime/node_modules/.bin \
    && rm -f /app/runtime/.dockerignore /app/runtime/.prettierrc /app/runtime/eslint.config.mjs /app/runtime/nest-cli.json /app/runtime/README.md /app/runtime/tsconfig.build.json /app/runtime/tsconfig.json \
    && find /app/runtime/dist -type f \( -name '*.d.ts' -o -name '*.js.map' -o -name '*.tsbuildinfo' \) -delete \
    && find /app/runtime/node_modules -type f \( -name '*.d.ts' -o -name '*.map' -o -name '*.md' -o -name '*.markdown' -o -name 'CHANGELOG*' -o -name 'LICENSE*' -o -name 'AUTHORS*' \) -delete \
    && find /app/runtime/node_modules -type d \( -name 'test' -o -name 'tests' -o -name '__tests__' -o -name 'docs' -o -name 'doc' -o -name 'examples' -o -name 'example' \) -prune -exec rm -rf '{}' + \
    && rm -rf /app/runtime/node_modules/@docmost/editor-ext/src \
    && rm -rf /app/runtime/node_modules/@docmost/editor-ext/node_modules \
    && rm -f /app/runtime/node_modules/@docmost/editor-ext/.prettierrc /app/runtime/node_modules/@docmost/editor-ext/README.md /app/runtime/node_modules/@docmost/editor-ext/tsconfig.json

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS installer

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=nonroot:nonroot /app/runtime/ /app/
COPY --from=builder --chown=nonroot:nonroot /app/apps/client/dist /app/apps/client/dist

VOLUME ["/app/data/storage"]

EXPOSE 3000

CMD ["apps/server/dist/main.js"]
