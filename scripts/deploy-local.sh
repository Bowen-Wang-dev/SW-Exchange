#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
ENV_FILE="$ROOT_DIR/.env.production"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

require_command docker

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is required. Install or enable 'docker compose' and try again." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env.production." >&2
  echo "Copy .env.production.example to .env.production and update the required values first." >&2
  exit 1
fi

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

resolve_env_value() {
  local key="$1"
  local value

  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

API_PORT="$(resolve_env_value PORT)"
if [[ -z "$API_PORT" ]]; then
  API_PORT=3001
fi

echo "Building production images..."
compose build

echo "Starting postgres..."
compose up -d postgres

echo "Waiting for postgres to become ready..."
for attempt in $(seq 1 30); do
  if compose exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    break
  fi

  if [[ "$attempt" -eq 30 ]]; then
    echo "Postgres did not become ready in time." >&2
    exit 1
  fi

  sleep 2
done

echo "Running database migrations..."
compose run --rm --no-deps api node apps/api/dist/scripts/migrate.js

echo "Running database seed..."
compose run --rm --no-deps api node apps/api/dist/scripts/seed.js

echo "Starting API and web..."
compose up -d api web

cat <<EOF
Deployment complete.

Web:        http://localhost:3000
API health: http://localhost:${API_PORT}/api/health

Logs:
  docker compose -f docker-compose.prod.yml --env-file .env.production logs -f --tail=200

Stop:
  docker compose -f docker-compose.prod.yml --env-file .env.production down
EOF
