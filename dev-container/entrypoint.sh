#!/bin/sh
set -e

echo "Installing dependencies..."
pnpm install

echo "Running database migrations..."
echo "Running database migrations..."
MAX_MIGRATION_ATTEMPTS=${MAX_MIGRATION_ATTEMPTS:-30}
attempt=1
until pnpm -F server run migration:latest; do
  if [ "$attempt" -ge "$MAX_MIGRATION_ATTEMPTS" ]; then
    echo "Database migrations failed after $attempt attempts. Aborting." >&2
    exit 1
  fi
  echo "Database not reachable yet (attempt $attempt/$MAX_MIGRATION_ATTEMPTS). Retrying in 2s..."
  attempt=$((attempt + 1))
  sleep 2
done

echo "Starting development server..."
exec pnpm dev
