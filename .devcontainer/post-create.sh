#!/usr/bin/env bash
# First-start setup for the dev container:
#  1. create .env from .env.example (only if missing) and point it at the
#     compose service hostnames, with a generated APP_SECRET
#  2. install workspace dependencies
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  SECRET="$(openssl rand -hex 32)"
  sed -i "s/REPLACE_WITH_LONG_SECRET/${SECRET}/" .env
  sed -i "s#postgresql://postgres:password@localhost:5432/docmost#postgresql://docmost:docmost@db:5432/docmost#" .env
  sed -i "s#redis://127.0.0.1:6379#redis://redis:6379#" .env
  echo ".env created for the dev container."
else
  echo ".env already exists, leaving it untouched."
fi

pnpm install
