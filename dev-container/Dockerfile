FROM node:22-alpine AS base

FROM base

WORKDIR /app

RUN npm install -g pnpm@10.4.0

RUN mkdir -p /app/data/storage /app/node_modules && \
    chown -R node:node /app

USER node

VOLUME ["/app/data/storage"]

EXPOSE 3000 5173 5019

COPY dev-container/entrypoint.sh /entrypoint.sh

CMD ["/entrypoint.sh"]
