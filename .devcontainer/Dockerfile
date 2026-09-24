FROM mcr.microsoft.com/devcontainers/javascript-node:1-24-bookworm

# Pin pnpm to the version required by the repo (packageManager field)
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

# psql CLI is handy for inspecting the dev database
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*
