FROM node:21-alpine AS base

FROM base as builder

WORKDIR /app

COPY . .

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base as installer

RUN apk add --no-cache curl bash

WORKDIR /app

COPY --from=builder /app/apps/server/dist /app/apps/server/dist
COPY --from=builder /app/apps/client/dist /app/apps/client/dist
COPY --from=builder /app/apps/server/package.json /app/apps/server/package.json
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/packages/ /app/packages/
COPY --from=builder /app/pnpm*.yaml /app/
# should optimize packages
RUN npm install -g pnpm

RUN chown -R node:node /app

USER node

RUN pnpm install --frozen-lockfile --prod

RUN mkdir -p /app/data/storage

VOLUME ["/app/data/storage"]

EXPOSE 3000

CMD ["pnpm", "start"]
