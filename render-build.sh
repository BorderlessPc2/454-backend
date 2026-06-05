#!/usr/bin/env bash
set -o errexit

echo "[render-build] Instalando dependências..."
npm ci

echo "[render-build] Gerando Prisma client..."
npm run prisma:generate

export PUPPETEER_CACHE_DIR="${PUPPETEER_CACHE_DIR:-/opt/render/project/.cache/puppeteer}"
mkdir -p "$PUPPETEER_CACHE_DIR"

echo "[render-build] Instalando Chrome para Puppeteer em $PUPPETEER_CACHE_DIR..."
npx puppeteer browsers install chrome --path "$PUPPETEER_CACHE_DIR"

echo "[render-build] Compilando TypeScript..."
npm run build

echo "[render-build] Concluído."
