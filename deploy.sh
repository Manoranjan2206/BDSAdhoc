#!/usr/bin/env bash
# =============================================================================
#  deploy.sh — BDSAdhoc production deploy / refresh for app.boldreportsdemo.com
#  Namespaced stack: project name = bdsadhoc-t1  (no clash with anything on host)
#
#  Usage:
#     ./deploy.sh                  # build (if image missing) + up -d
#     ./deploy.sh --build          # force rebuild of the app image
#     ./deploy.sh --pull           # pull image from a registry instead of building
#     ./deploy.sh --logs           # tail logs after start
#     ./deploy.sh --stop           # stop the stack
#     ./deploy.sh --restart-nginx  # reload nginx only (after cert rotation)
#
#  Prereqs:
#     - Docker + Docker Compose v2 (docker compose)
#     - .env.prod filled in
#     - TLS cert files at the paths declared in .env.prod
#     - This script must be run from the repo root
#
#  IMPORTANT:
#     - This stack uses project name "bdsadhoc-t1" so it does NOT collide
#       with any other container on the host.
#     - HTTPS is exposed on host port 8443 (because 443 is already taken
#       by the existing `boldreports` container). URL is:
#       https://app.boldreportsdemo.com:8443
# =============================================================================
set -euo pipefail

# ---- Colors for output ----
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)]${NC} $*"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)] ERROR:${NC} $*" >&2; }

# ---- Project name (overrides default directory-based name) ----
PROJECT_NAME="bdsadhoc-t1"

# ---- Namespaced container names ----
PG_C="bdsadhoc-t1-postgres"
APP_C="bdsadhoc-t1-app"
NGX_C="bdsadhoc-t1-nginx"

# ---- Public URL (HTTPS port 8443, not 443) ----
PUBLIC_URL="https://app.boldreportsdemo.com:8443"
HTTP_URL="http://app.boldreportsdemo.com:8080"

# ---- Pre-flight checks ----
cd "$(dirname "$0")"

command -v docker >/dev/null 2>&1 || { err "docker not found — install Docker first"; exit 1; }
docker compose version >/dev/null 2>&1 || { err "docker compose plugin not found"; exit 1; }

[[ -f .env.prod ]] || { err ".env.prod missing — copy from .env.prod.example and fill in"; exit 1; }

# Load env vars (skip comments, export everything)
set -a; source .env.prod; set +a

# ---- Sanity: TLS certs must exist ----
[[ -f "${TLS_CERT_FULLCHAIN_PATH}" ]] || { err "Cert not found: ${TLS_CERT_FULLCHAIN_PATH}"; exit 1; }
[[ -f "${TLS_CERT_KEY_PATH}"       ]] || { err "Key  not found: ${TLS_CERT_KEY_PATH}"; exit 1; }
warn "Using cert: ${TLS_CERT_FULLCHAIN_PATH}"

# ---- Parse flags ----
DO_BUILD=0; DO_PULL=0; DO_LOGS=0; DO_STOP=0; DO_NGINX=0
for arg in "$@"; do
  case $arg in
    --build)         DO_BUILD=1 ;;
    --pull)          DO_PULL=1 ;;
    --logs)          DO_LOGS=1 ;;
    --stop)          DO_STOP=1 ;;
    --restart-nginx) DO_NGINX=1 ;;
    -h|--help)
      sed -n '4,16p' "$0"; exit 0 ;;
    *) err "Unknown flag: $arg"; exit 1 ;;
  esac
done

CMD="docker compose -p ${PROJECT_NAME} -f docker-compose.prod.yml --env-file .env.prod"

# ---- Stop only ----
if [[ $DO_STOP -eq 1 ]]; then
  log "Stopping BDSAdhoc stack (project: ${PROJECT_NAME})..."
  $CMD stop
  log "Done."
  exit 0
fi

# ---- Reload nginx only (after cert rotation) ----
if [[ $DO_NGINX -eq 1 ]]; then
  log "Reloading nginx..."
  $CMD exec ${NGX_C} nginx -s reload
  log "Nginx reloaded."
  exit 0
fi

# ---- Pull image from registry ----
if [[ $DO_PULL -eq 1 ]]; then
  log "Pulling bdsadhoc-bdsadhoc:latest from registry..."
  docker pull bdsadhoc-bdsadhoc:latest
fi

# ---- Build image if requested OR if no image exists locally ----
if [[ $DO_BUILD -eq 1 ]] || ! docker image inspect bdsadhoc-bdsadhoc:latest >/dev/null 2>&1; then
  if [[ $DO_PULL -eq 1 ]]; then
    err "Cannot use --build and --pull together"; exit 1
  fi
  log "Building bdsadhoc-bdsadhoc:latest from Dockerfile..."
  $CMD build bdsadhoc
fi

# ---- Up the stack ----
log "Starting BDSAdhoc stack (project: ${PROJECT_NAME})..."
$CMD up -d

# ---- Wait for postgres healthcheck ----
log "Waiting for ${PG_C} to become healthy..."
for i in {1..30}; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' ${PG_C} 2>/dev/null || echo "starting")
  if [[ "$STATUS" == "healthy" ]]; then
    log "Postgres is healthy."
    break
  fi
  sleep 2
done

# ---- Wait for app healthcheck ----
log "Waiting for app to respond on ${PUBLIC_URL}..."
for i in {1..30}; do
  CODE=$(curl -kfsS -o /dev/null -w "%{http_code}" "${PUBLIC_URL}/api/crm/home-summary?email=alpha1@alphacorp.com" 2>/dev/null || echo "")
  if [[ "$CODE" == "200" ]]; then
    log "App is responding on HTTPS."
    break
  fi
  sleep 2
done

# ---- Smoke tests ----
log "Running smoke tests..."
echo "  - /health  ........... $(curl -kfsS -o /dev/null -w '%{http_code}' ${PUBLIC_URL}/health  2>/dev/null || echo 'FAIL')"
echo "  - / (SPA)  .......... $(curl -kfsS -o /dev/null -w '%{http_code}' ${PUBLIC_URL}/        2>/dev/null || echo 'FAIL')"
echo "  - /api/crm/deals ... $(curl -kfsS -o /dev/null -w '%{http_code}' "${PUBLIC_URL}/api/crm/deals?email=alpha1@alphacorp.com&tenantName=AlphaCorp&role=Admin&region=North%20America" 2>/dev/null || echo 'FAIL')"
echo "  - HTTP redirect .... $(curl -sS -o /dev/null -w 'HTTP %{http_code} -> %{redirect_url}' ${HTTP_URL}/ 2>/dev/null || echo 'FAIL')"

# ---- Tail logs if requested ----
if [[ $DO_LOGS -eq 1 ]]; then
  log "Tailing logs (Ctrl-C to exit)..."
  $CMD logs -f
fi

log "Deploy complete. Stack running:"
$CMD ps
