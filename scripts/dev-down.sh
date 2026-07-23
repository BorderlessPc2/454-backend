#!/usr/bin/env bash
# Para os containers do ambiente local (Postgres + Redis)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Parando containers (Postgres + Redis)"
docker compose down
echo "✅ Containers parados"
