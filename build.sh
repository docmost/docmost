#!/usr/bin/env bash
# Baut das Custom-Docmost-Image (mit databaseTable-Block) und startet die isolierte DEV-Instanz (:3003).
# Produktive Docmost (:3002) wird NICHT angefasst.
set -euo pipefail
cd /opt/stack/docmost-fork
echo ">> docker build docmost-custom:local"
docker build -t docmost-custom:local .
cd /opt/stack
echo ">> (re)start docmost-dev (:3003)"
docker compose up -d docmost-dev
echo ">> fertig. Test: http://$(grep '^SERVER_IP=' .env | cut -d= -f2):3003"
