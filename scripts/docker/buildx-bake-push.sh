#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   TAG=1.2.3 ./scripts/docker/buildx-bake-push.sh
#
# Optional env vars:
#   IMAGE=harbor.10layer.com/docmost/docmost
#   TAG=dev
#   BUILDX_BUILDER=docmost-multiarch

IMAGE="${IMAGE:-harbor.10layer.com/docmost/docmost}"
TAG="${TAG:-dev}"
BUILDX_BUILDER="${BUILDX_BUILDER:-docmost-multiarch}"

if ! docker buildx inspect "${BUILDX_BUILDER}" >/dev/null 2>&1; then
  docker buildx create --name "${BUILDX_BUILDER}" --use
else
  docker buildx use "${BUILDX_BUILDER}"
fi

docker buildx inspect --bootstrap >/dev/null

IMAGE="${IMAGE}" TAG="${TAG}" docker buildx bake

