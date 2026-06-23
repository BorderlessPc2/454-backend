#!/bin/sh
set -e

echo "[startup] NODE_ENV=${NODE_ENV:-not-set} PORT=${PORT:-not-set}"
echo "[startup] DATABASE_URL=${DATABASE_URL:+***configurada***}"

if [ -z "${DATABASE_URL}" ]; then
  echo "[startup] ❌ DATABASE_URL não está definida!"
  echo "[startup] Configure a variável de ambiente DATABASE_URL no Render."
  exit 1
fi

# Render: expande host interno curto dpg-xxx-a → endpoint Oregon
export DATABASE_URL="$(node ./scripts/normalize-render-database-url.mjs)"
RUNTIME_DATABASE_URL="${DATABASE_URL}"

echo "[startup] ✅ DATABASE_URL (runtime) configurada"
echo "[startup] Resolvendo URL de migrate (conexão direta, sem pooler)..."

MIGRATE_DATABASE_URL="$(node ./scripts/resolve-migrate-database-url.mjs)"

echo "[startup] Executando Prisma migrate deploy..."

# P1002: aumenta timeout do advisory lock em deploys concorrentes / cold start Neon
export PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT="${PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT:-60000}"

if ! DATABASE_URL="${MIGRATE_DATABASE_URL}" npx prisma migrate deploy; then
  echo "[startup] ❌ prisma migrate deploy falhou — abortando."
  echo "[startup]"
  echo "[startup] Neon + pooler (P1002 advisory lock):"
  echo "[startup]   • DATABASE_URL no Render = connection string COM -pooler (app em runtime)"
  echo "[startup]   • Adicione DIRECT_URL = connection string SEM -pooler (Neon Console → Connect → Direct)"
  echo "[startup]   • Ou deixe o script converter automaticamente (já tentado acima)"
  echo "[startup]"
  echo "[startup] Render Postgres (P1001):"
  echo "[startup]   • Use External Database URL com ?sslmode=require"
  echo "[startup]   • Confira se o Postgres free não está suspenso"
  exit 1
fi

echo "[startup] ✅ Migrations aplicadas com sucesso."

export DATABASE_URL="${RUNTIME_DATABASE_URL}"
echo "[startup] ✅ Iniciando servidor Node na porta ${PORT:-3000}..."
exec node dist/server.js
