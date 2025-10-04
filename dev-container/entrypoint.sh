#!/bin/sh
set -e

echo "Installing dependencies..."
pnpm install

echo "Running database migrations..."
until pnpm -F server run migration:latest; do
  echo "Database not reachable yet. Retrying in 2s..."
  sleep 2
done

echo "Starting development server..."
exec pnpm dev
