#!/usr/bin/env bash
# Sobe o ambiente local: Docker (Postgres + Redis) → deps → migrations → API
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEED=0
SKIP_INSTALL=0

usage() {
  cat <<'EOF'
Uso: ./scripts/dev-up.sh [opções]

Sobe Postgres/Redis via Docker, prepara o projeto e inicia a API em modo dev.

Opções:
  --seed          Roda o seed após as migrations (admin / admin123)
  --skip-install  Não executa npm install
  -h, --help      Mostra esta ajuda

Equivalente npm: npm run up
                  npm run up -- --seed
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed) SEED=1; shift ;;
    --skip-install) SKIP_INSTALL=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Opção desconhecida: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

echo "==> 454-backend — subindo ambiente local"

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Docker CLI não encontrado. Instale Docker ou Colima e tente de novo." >&2
    exit 1
  fi

  if docker info >/dev/null 2>&1; then
    echo "==> Docker já está em execução"
    return 0
  fi

  DOCKER_CONTEXT="$(docker context show 2>/dev/null || true)"

  # Preferência: Colima (contexto atual ou sem Docker Desktop)
  if command -v colima >/dev/null 2>&1 && {
    [[ "$DOCKER_CONTEXT" == "colima" ]] ||
    [[ "$DOCKER_CONTEXT" == colima* ]] ||
    [[ ! -d "/Applications/Docker.app" ]]
  }; then
    echo "==> Docker parado — iniciando Colima..."
    colima start
  elif [[ "$(uname -s)" == "Darwin" ]] && [[ -d "/Applications/Docker.app" ]]; then
    echo "==> Docker parado — abrindo Docker Desktop..."
    open -a Docker
  elif [[ "$(uname -s)" == "Linux" ]]; then
    echo "==> Docker parado — tentando iniciar o serviço docker..."
    if command -v systemctl >/dev/null 2>&1; then
      sudo systemctl start docker >/dev/null 2>&1 || true
    fi
  else
    echo "❌ Docker daemon parado." >&2
    echo "   Neste Mac o contexto aponta para Colima. Rode: colima start" >&2
    exit 1
  fi

  echo "==> Aguardando o Docker ficar pronto (pode levar ~30–60s)"
  ATTEMPTS=0
  MAX_ATTEMPTS=90
  until docker info >/dev/null 2>&1; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [[ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]]; then
      echo "❌ Docker não ficou pronto a tempo." >&2
      echo "   Tente manualmente: colima start" >&2
      exit 1
    fi
    sleep 2
  done
  echo "==> Docker pronto"
}

ensure_docker

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js não encontrado. Instale Node.js 20+ e tente de novo." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "❌ Node.js 20+ é necessário (atual: $(node -v))." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "==> Criando .env a partir de .env.example"
  cp .env.example .env
else
  echo "==> .env já existe — mantendo"
fi

echo "==> Subindo Postgres e Redis (Docker)"
docker compose up -d --wait

echo "==> Aguardando Postgres aceitar conexões"
ATTEMPTS=0
MAX_ATTEMPTS=60
until docker compose exec -T postgres \
  bash -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [[ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]]; then
    echo "❌ Postgres não ficou pronto a tempo." >&2
    docker compose ps >&2 || true
    exit 1
  fi
  sleep 1
done
echo "==> Postgres pronto"

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  echo "==> Instalando dependências (npm install)"
  npm install
else
  echo "==> Pulando npm install (--skip-install)"
fi

echo "==> Gerando Prisma Client"
npm run prisma:generate

echo "==> Aplicando migrations"
npm run prisma:migrate:deploy

if [[ "$SEED" -eq 1 ]]; then
  echo "==> Rodando seed (admin / admin123)"
  npm run prisma:seed
fi

echo ""
echo "✅ Ambiente pronto"
echo "   API:      http://localhost:3000"
echo "   Swagger:  http://localhost:3000/api-docs"
echo "   Postgres: localhost:5433"
echo "   Redis:    localhost:6380"
if [[ "$SEED" -eq 1 ]]; then
  echo "   Login:    admin / admin123"
fi
echo ""
echo "==> Iniciando API (npm run dev)"
exec npm run dev
