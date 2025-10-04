#!/bin/sh
set -e

echo "Installing dependencies..."
pnpm install

echo "Running database migrations..."
pnpm -F server run migration:latest

echo "Starting development server..."
exec pnpm dev
