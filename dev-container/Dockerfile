FROM node:22-alpine AS base
LABEL org.opencontainers.image.source="https://github.com/docmost/docmost"

FROM base

WORKDIR /app

COPY . .

RUN npm install -g pnpm@10.4.0
RUN pnpm install

RUN chown -R node:node /app

USER node

RUN mkdir -p /app/data/storage

VOLUME ["/app/data/storage"]

EXPOSE 3000

CMD ["pnpm", "server:start"]
