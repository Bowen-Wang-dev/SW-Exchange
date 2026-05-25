#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
ENV_FILE="$ROOT_DIR/.env.production"
checks_passed=0
checks_failed=0

resolve_env_value() {
  local key="$1"
  local value

  if [[ ! -f "$ENV_FILE" ]]; then
    return
  fi

  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

api_port="${API_PORT:-$(resolve_env_value PORT)}"
if [[ -z "$api_port" ]]; then
  api_port=3001
fi

API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:${api_port}/api/health}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3000}"

check_with_curl() {
  local label="$1"
  local url="$2"
  local expected="${3:-}"
  local response

  if ! response="$(curl -fsS "$url")"; then
    echo "FAIL $label"
    checks_failed=$((checks_failed + 1))
    return
  fi

  if [[ -n "$expected" ]] && [[ "$response" != *"$expected"* ]]; then
    echo "FAIL $label"
    checks_failed=$((checks_failed + 1))
    return
  fi

  echo "PASS $label"
  checks_passed=$((checks_passed + 1))
}

check_with_wget() {
  local label="$1"
  local url="$2"

  if ! wget -qO- "$url" >/dev/null; then
    echo "FAIL $label"
    checks_failed=$((checks_failed + 1))
    return
  fi

  echo "PASS $label"
  checks_passed=$((checks_passed + 1))
}

echo "Deployment verification starting..."

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && [[ -f "$COMPOSE_FILE" ]] && [[ -f "$ENV_FILE" ]]; then
  if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps; then
    echo "PASS docker compose ps"
    checks_passed=$((checks_passed + 1))
  else
    echo "FAIL docker compose ps"
    checks_failed=$((checks_failed + 1))
  fi
fi

if command -v curl >/dev/null 2>&1; then
  check_with_curl "api health" "$API_HEALTH_URL" "\"status\":\"ok\""
  check_with_curl "web root" "$WEB_URL"
elif command -v wget >/dev/null 2>&1; then
  check_with_wget "api health" "$API_HEALTH_URL"
  check_with_wget "web root" "$WEB_URL"
else
  echo "FAIL no curl or wget available for HTTP verification"
  checks_failed=$((checks_failed + 1))
fi

echo
echo "Verification summary: ${checks_passed} passed, ${checks_failed} failed."

if [[ "$checks_failed" -gt 0 ]]; then
  exit 1
fi
