#!/usr/bin/env bash
# ============================================================
# BDSAdhoc remote deploy helper
# Run on the VM after extracting the deployment bundle zip.
# ============================================================
set -euo pipefail

cd "$(dirname "$0")"

ts() { date +%Y%m%d-%H%M%S; }

echo "==> [1/5] Loading new image into Docker"
docker load -i bdsadhoc-app.tar

echo "==> [2/5] Backing up running postgres volume data via pg_dumpall"
mkdir -p backups
pgdump="backups/postgres_$(ts).sql"
docker exec bdsadhoc-postgres pg_dumpall -U postgres > "$pgdump" || {
  echo "WARN: pg_dumpall failed (container may be down). Continuing." >&2
}
[ -s "$pgdump" ] && echo "    saved: $pgdump ($(du -h "$pgdump" | cut -f1))"

echo "==> [3/5] Stopping & removing old app container (keeps postgres + data)"
# Stop only the app + proxy so the database stays up
docker compose stop bdsadhoc nginx || true
docker compose rm -f bdsadhoc || true
# remove the old image so the new tag takes effect
docker image rm bdsadhoc-app:latest bdsadhoc-bdsadhoc:latest 2>/dev/null || true

echo "==> [4/5] Bringing up bdsadhoc + nginx (postgres is untouched)"
docker compose up -d bdsadhoc nginx

echo "==> [5/5] Container status"
docker compose ps
echo
docker inspect --format '{{.Name}}  status={{.State.Status}}  image={{.Image}}' bdsadhoc-app

echo
echo "Tail app logs (Ctrl+C to exit):"
docker logs --tail 40 bdsadhoc-app || true