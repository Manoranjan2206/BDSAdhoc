# BDSAdhoc — Linux Production Deployment

Complete runbook for deploying and operating **BDSAdhoc** (React + .NET 10 +
PostgreSQL) on the **boldbi-presale-vm** (Ubuntu 24.04 LTS) at
**`https://app.boldreportsdemo.com:8443`**.

This document covers **everything**: the VM, file locations, secrets, network,
deploy/rollback, day-to-day ops, troubleshooting, and recovery.

> **Companion docs**
> - `LINUX-DEPLOYMENT.md` — original generic deploy guide (HTTPS on 8443)
> - `CONTAINER-DEPLOYMENT-GUIDE.md` — Syncfusion reference for Bold BI/Reports
> - `dist_linux/ROLLBACK-GUIDE.md` — quick rollback for the Sept 15 backup
> - `dist_linux/docker-compose.yml` — the **actual** compose file used in prod

---

## Table of Contents

1. [Why this stack](#1-why-this-stack)
2. [Host & VM details](#2-host--vm-details)
3. [File & folder locations on the VM](#3-file--folder-locations-on-the-vm)
4. [Secrets & configuration](#4-secrets--configuration)
5. [Container stack overview](#5-container-stack-overview)
6. [Initial deploy (first time)](#6-initial-deploy-first-time)
7. [Rebuild & refresh after code change](#7-rebuild--refresh-after-code-change)
8. [Day-to-day operation](#8-day-to-day-operation)
9. [Logs & troubleshooting](#9-logs--troubleshooting)
10. [Backup & rollback](#10-backup--rollback)
11. [Security checklist](#11-security-checklist)
12. [Appendix A — full file tree shipped to VM](#appendix-a--full-file-tree-shipped-to-vm)

---

## 1. Why this stack

The VM (`boldbi-presale-vm`, **192.168.7.68**) already hosts:

| Container          | Bound to host               |
|--------------------|-----------------------------|
| `keycloak`         | `127.0.0.1:8080`            |
| `keycloak-postgres`| (network only)              |
| `boldreports`      | `443`, `8090`, internal     |
| `reportserver_pgdb_1` | (network only)           |

To avoid clashing, the BDSAdhoc stack is **fully isolated** under compose
project name **`bdsadhoc`** with port **`8085`** bound only to the host's
loopback. Public access is reverse-proxied from the existing
`boldreports` container (port 443 → `127.0.0.1:8085`).

```
        Internet ──► boldreports (443) ──► 127.0.0.1:8085 ──► bdsadhoc-nginx ──► bdsadhoc-app ──► bdsadhoc-postgres
```

---

## 2. Host & VM details

| Item                | Value                                            |
|---------------------|--------------------------------------------------|
| VM hostname         | `boldbi-presale-vm`                              |
| VM IP (LAN)         | `192.168.7.68`                                   |
| Public URL          | `https://app.boldreportsdemo.com:8443`           |
| OS                  | Ubuntu 24.04 LTS                                 |
| Kernel              | 6.17                                             |
| Docker              | 29.7.2                                           |
| Docker Compose      | v2.x                                             |
| SSH user            | `syncfusion`                                     |
| SSH key (Windows)   | `D:/gcp-boldbi-presale-vm.ppk`                   |
| Project dir on VM   | `/var/www/boldreports/adhoc-embeeded`            |
| Compose project     | `bdsadhoc`                                       |

> ⚠️ **Never** run `docker system prune`. It will delete the host's other
> containers (`keycloak`, `boldreports`, etc.).

---

## 3. File & folder locations on the VM

Everything for BDSAdhoc lives in **one** folder:

```
/var/www/boldreports/adhoc-embeeded/
├── docker-compose.yml          ← CURRENT production compose
├── .env                         ← CURRENT secrets (chmod 600)
├── .env.sep15-backup            ← backup of prev secrets
├── bdsadhoc-app.tar             ← latest saved image (tar export)
├── bdsadhoc-app-BACKUP-sep15.tar ← pre-Sept 15 image
├── nginx/
│   ├── nginx.conf                ← host-port-8085 setup
│   ├── default.conf              ← reverse-proxy rules
│   ├── nginx.conf.sep15-backup
│   └── default.conf.sep15-backup
├── sql/                         ← mounted into postgres initdb
└── ROLLBACK-GUIDE.md
```

### Container-internal paths (read-only reference)

| Container           | Internal path used             | Purpose                  |
|---------------------|--------------------------------|--------------------------|
| `bdsadhoc-app`      | `/app`                         | .NET app + Vite SPA      |
|                     | `http://+:8080`                | Kestrel listen           |
| `bdsadhoc-postgres` | `/var/lib/postgresql/data`     | PG data (volume)         |
|                     | `/docker-entrypoint-initdb.d`  | SQL seed files (mount)   |
| `bdsadhoc-nginx`    | `/etc/nginx/nginx.conf`        | master config (mount)    |
|                     | `/etc/nginx/conf.d/default.conf` | server block (mount)   |
|                     | `/var/cache/nginx`             | cache volume             |

### Docker volumes used

| Volume name                | Mounted in            | Notes                |
|----------------------------|-----------------------|----------------------|
| `bdsadhoc-postgres-data`   | `bdsadhoc-postgres`   | persisted DB state   |
| `bdsadhoc-nginx-cache`     | `bdsadhoc-nginx`      | proxy cache          |

### Docker network

| Network name       | Driver | Used by                                              |
|--------------------|--------|------------------------------------------------------|
| `bdsadhoc-net`     | bridge | `bdsadhoc-postgres`, `bdsadhoc-app`, `bdsadhoc-nginx` |

---

## 4. Secrets & configuration

All runtime configuration is driven by environment variables defined in
`/var/www/boldreports/adhoc-embeeded/.env` (mode `0600`).

```ini
# ---- PostgreSQL ----
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Password123!

# ---- Bold Reports (site11) ----
BR_ReportRootUrl=https://adhoc.boldreports.com/reporting
BR_SiteIdentifier=site11
BR_AdminUser=manoranjan.rajendran@syncfusion.com
BR_AdminPassword=Admin@123
BR_EmbedSecret=0Ff8yJ8lr7zB9VrBAyUHSDolm19ja1A

# ---- Bold BI (site12) ----
BBI_ServerUrl=https://adhoc.boldreports.com/bi
BBI_SiteIdentifier=site12
BBI_AdminUser=manoranjan.rajendran@syncfusion.com
BBI_AdminPassword=Admin@123
BBI_EmbedSecret=e0jXV3jpdNDoEtsEfHQdR1dzxV6zGaCw
BBI_UserEmail=manoranjan.rajendran@syncfusion.com
BBI_Environment=onpremise
```

### Important rules

1. **The two `*_EmbedSecret` values MUST be different.**
   - BR_EmbedSecret = `0Ff8yJ8lr7zB9VrBAyUHSDolm19ja1A` (Reports / site11)
   - BBI_EmbedSecret = `e0jXV3jpdNDoEtsEfHQdR1dzxV6zGaCw` (BI / site12)
2. The `.NET` build also reads `BoldAdhocEmbed.Server/appsettings.Production.json`.
   Values in `.env` **must match** the JSON file. Changing only one side will
   cause 401s.
3. Never commit `.env` to git. See `.gitignore`.
4. After editing `.env`, restart the app: `docker compose -p bdsadhoc restart bdsadhoc`.

---

## 5. Container stack overview

The production compose (`dist_linux/docker-compose.yml`, deployed at
`/var/www/boldreports/adhoc-embeeded/docker-compose.yml`) starts **3
containers**:

| Container           | Image                       | Restart | Internal port | Host port                  |
|---------------------|-----------------------------|---------|---------------|----------------------------|
| `bdsadhoc-postgres` | `postgres:16-alpine`        | always  | 5432          | `0.0.0.0:5432` (admin)     |
| `bdsadhoc-app`      | `bdsadhoc-app:latest`       | always  | 8080          | (network only)             |
| `bdsadhoc-nginx`    | `nginx:1.27-alpine`         | always  | 80            | **`127.0.0.1:8085:80`**    |

Upstream (from nginx): `bdsadhoc:8080`.

### Healthchecks

| Container           | Healthcheck                                                             |
|---------------------|-------------------------------------------------------------------------|
| `bdsadhoc-postgres` | `pg_isready -U ${POSTGRES_USER}`                                        |
| `bdsadhoc-app`      | `wget http://localhost:8080/api/crm/home-summary?email=alpha1@alphacorp.com` |
| `bdsadhoc-nginx`    | `wget http://localhost/health`                                          |

### Log rotation built-in

Each container uses the `json-file` driver with:
- `max-size: 10m`
- `max-file: 3`   → keeps last 30 MB per container.

---

## 6. Initial deploy (first time)

> If this is your **first** deploy on a clean VM, follow every step. If
> the stack already exists, jump to [§7](#7-rebuild--refresh-after-code-change).

### 6.1 Bundle the project on Windows

From `D:\GitHub\BDSAdhoc`:

```powershell
# Skip dev artefacts to keep the tarball small
tar --exclude='node_modules' --exclude='bin' --exclude='obj' `
    --exclude='*.user' --exclude='.git' `
    -czf bdsadhoc.tar.gz `
    BoldAdhocEmbed.slnx BoldAdhocEmbed.Server boldadhocembed.client `
    docker-compose.yml .env nginx sql
```

### 6.2 Copy the bundle to the VM

Using PuTTY `pscp` (with the key in ppk format):

```powershell
pscp -i D:\gcp-boldbi-presale-vm.ppk `
     D:\GitHub\BDSAdhoc\bdsadhoc.tar.gz `
     syncfusion@boldbi-presale-vm:~/bdsadhoc.tar.gz
```

### 6.3 Extract and stage on the VM

```bash
mkdir -p /var/www/boldreports/adhoc-embeeded
tar -xzf ~/bdsadhoc.tar.gz -C /var/www/boldreports/adhoc-embeeded \
  --strip-components=0
cd /var/www/boldreports/adhoc-embeeded
ls -la   # expect: docker-compose.yml, .env, nginx/, sql/
```

### 6.4 Lock down secrets

```bash
chmod 600 .env            # never run with world-readable .env
chown syncfusion:syncfusion .env
```

### 6.5 Build the image on the VM

```bash
sudo docker build \
  -t bdsadhoc-app:latest \
  -f BoldAdhocEmbed.Server/Dockerfile \
  .
```

This builds the multi-stage image (node 20 → npm install → vite build → dotnet
publish → ASP.NET runtime). **First run: 5–15 minutes.** Subsequent runs cache
npm + NuGet and finish in 1–3 minutes.

### 6.6 Save a copy of the image (optional but recommended)

```bash
sudo docker save bdsadhoc-app:latest | gzip > bdsadhoc-app.tar
```

### 6.7 Bring the stack up

```bash
cd /var/www/boldreports/adhoc-embeeded
sudo docker compose -p bdsadhoc up -d
sudo docker compose -p bdsadhoc ps   # wait ~30 s for postgres healthcheck
```

### 6.8 Smoke-test

```bash
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8085/health
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8085/api/crm/home-summary?email=alpha1@alphacorp.com

# Public URL (proxied through host :443)
curl -kI https://app.boldreportsdemo.com:8443/
```

---

## 7. Rebuild & refresh after code change

Use this exact loop when you push new code and want the **same VM** to
pick it up.

### 7.1 On the dev box

```powershell
# push your code, confirm git is clean
Push-Location d:\GitHub\BDSAdhoc
git status
git log --oneline -1
Pop-Location
```

### 7.2 Build locally on Windows (faster feedback, tarball ready to ship)

```powershell
# Single command (matches what the VM does)
docker build -t bdsadhoc-app:latest -f BoldAdhocEmbed.Server/Dockerfile .

# Smoke-test the new image locally
docker compose -p bdsadhoc -f dist_linux/docker-compose.local-test.yml up -d
curl http://127.0.0.1:8085/health
docker compose -p bdsadhoc -f dist_linux/docker-compose.local-test.yml down -v
```

### 7.3 Ship to VM

```powershell
# 7.3.1 Save the new image as a tarball and SCP it
docker save bdsadhoc-app:latest | gzip > d:\GitHub\BDSAdhoc\bdsadhoc-app.tar
pscp -i D:\gcp-boldbi-presale-vm.ppk `
     d:\GitHub\BDSAdhoc\bdsadhoc-app.tar `
     syncfusion@boldbi-presale-vm:~/bdsadhoc-app.tar
```

### 7.4 Replace and restart on the VM

```bash
# Load the new image
sudo docker load -i ~/bdsadhoc-app.tar

# Restart only the app container (nginx + postgres keep running)
cd /var/www/boldreports/adhoc-embeeded
sudo docker compose -p bdsadhoc up -d --no-deps bdsadhoc
sudo docker compose -p bdsadhoc ps
```

### 7.5 If you also need to ship code/config changes

```powershell
tar --exclude='node_modules' --exclude='bin' --exclude='obj' `
    -czf bdsadhoc.tar.gz `
    BoldAdhocEmbed.slnx BoldAdhocEmbed.Server boldadhocembed.client `
    docker-compose.yml .env nginx sql
pscp -i D:\gcp-boldbi-presale-vm.ppk `
     bdsadhoc.tar.gz syncfusion@boldbi-presale-vm:~/
```

```bash
sudo tar -xzf ~/bdsadhoc.tar.gz -C /var/www/boldreports/adhoc-embeeded \
    --overwrite --keep-old-files
sudo chown -R syncfusion:syncfusion /var/www/boldreports/adhoc-embeeded
sudo docker compose -p bdsadhoc up -d --no-deps
```

---

## 8. Day-to-day operation

All commands assume you are on the VM, in the deploy dir:

```bash
cd /var/www/boldreports/adhoc-embeeded
alias dc='sudo docker compose -p bdsadhoc'
```

| Need                                | Command                                                  |
|-------------------------------------|----------------------------------------------------------|
| View running services                | `dc ps`                                                  |
| Start the stack (after a stop)       | `dc start`                                               |
| Stop (data preserved)                | `dc stop`                                                |
| Restart everything                   | `dc restart`                                             |
| Restart only the app                 | `dc restart bdsadhoc`                                    |
| Tail logs (all)                      | `dc logs -f`                                             |
| Tail logs (app only)                 | `dc logs -f bdsadhoc`                                    |
| Tail logs (last 200 lines)           | `dc logs --tail=200 bdsadhoc`                            |
| Inspect env of running app           | `dc exec bdsadhoc env \| grep -E 'POSTGRES|Bold'`        |
| Shell into app                       | `dc exec bdsadhoc bash` (or `sh`)                        |
| Recreate only app without deps       | `dc up -d --no-deps bdsadhoc`                            |
| Force recreate app                   | `dc up -d --force-recreate --no-deps bdsadhoc`           |
| Check disk usage of stack            | `docker system df -v \| grep -E 'bdsadhoc|postgres-data'` |
| List stack's volumes                 | `docker volume ls -f name=bdsadhoc`                      |
| List stack's networks                | `docker network ls -f name=bdsadhoc`                     |

---

## 9. Logs & troubleshooting

### 9.1 Where to look first

```bash
dc logs --tail=200 bdsadhoc | grep -E 'error|warn|exception|EmbedSecret'
dc logs --tail=100 bdsadhoc-postgres | grep -E 'error|ready|init process'
dc logs --tail=100 bdsadhoc-nginx    | grep -E 'error|warn'
```

### 9.2 Common problems

| Symptom                                                       | Likely cause                                                          | Fix                                                                                       |
|---------------------------------------------------------------|-----------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| `curl :8085/health` → 000                                     | nginx container down                                                  | `dc up -d bdsadhoc-nginx`                                                                 |
| `/api/crm/home-summary` → `Unable to authenticate with Bold`  | `BR_EmbedSecret` doesn't match server-side repo                        | Re-verify `dist_linux/.env` vs `BoldAdhocEmbed.Server/appsettings.Production.json`        |
| Reports page never loads                                      | **Password-grant** rejected by Bold Reports Cloud (only embed_secret) | Confirm `BaseController.GetEmbedTokenAsync` uses `grant_type=embed_secret` and `BR_EmbedSecret` |
| Container stuck on `Restarting (1)`                           | App crash on boot — usually wrong env or missing secret                | `dc logs --tail=200 bdsadhoc` and fix `.env`                                              |
| `pg_isready` fails                                            | Wrong `POSTGRES_PASSWORD`                                             | Match across `.env` and any reused image history                                          |
| First-run slowness on `home-summary`                          | Postgres still seeding 4 tenant DBs                                   | Wait ~30 s after first `up -d`                                                            |
| App returns 502 from nginx                                    | App container not yet healthy                                         | `dc ps`; if `bdsadhoc` is unhealthy, inspect logs                                         |
| Public URL 404                                                | Host firewall blocks 443 → 8085 reverse-proxy                         | Check the existing `boldreports` container: `docker inspect boldreports \| grep -i port` |
| Cannot SSH to VM                                              | Wrong key / user                                                      | Verify `D:/gcp-boldbi-presale-vm.ppk` and username `syncfusion`                           |
| Disk filling up                                                | json-file logs + Postgres WAL                                         | `docker system df` and prune logs; archive Postgres via `pg_dump`                          |

### 9.3 Hard reset (data destructive)

```bash
cd /var/www/boldreports/adhoc-embeeded
sudo docker compose -p bdsadhoc down -v   # also removes bdsadhoc-postgres-data
sudo docker compose -p bdsadhoc up -d
# → first run will reseed 4 tenant DBs from ./sql
```

### 9.4 Reset ONLY Postgres (keep code)

```bash
sudo docker compose -p bdsadhoc down
sudo docker volume rm bdsadhoc-postgres-data
sudo docker compose -p bdsadhoc up -d
```

### 9.5 Tail a specific request

`json-file` driver timestamps help correlate:

```bash
dc logs -t bdsadhoc | grep -i 'EmbedToken\|embed_token' | tail
```

### 9.6 Inside-app logs (structured)

The .NET app writes to stdout (`Microsoft.Extensions.Logging.Console`).
Increase verbosity at runtime:

```bash
sudo docker compose -p bdsadhoc stop bdsadhoc
sudo docker compose -p bdsadhoc up -d \
  -e Logging__LogLevel__Default=Debug \
  -e Logging__LogLevel__BoldAdhocEmbed=Trace \
  bdsadhoc
```

---

## 10. Backup & rollback

### 10.1 Image backup (always do this before a deploy)

```bash
# On the VM, before any change:
sudo docker save bdsadhoc-app:latest | gzip > \
  /var/www/boldreports/adhoc-embeeded/bdsadhoc-app.tar
```

### 10.2 Postgres backup

```bash
# Single-tenant dump
sudo docker exec bdsadhoc-postgres \
  pg_dump -U postgres -d alphacorp | gzip > /tmp/alphacorp.sql.gz

# All tenants in one go
for db in alphacorp betasolutions deltaenterprises gammaindustries; do
  sudo docker exec bdsadhoc-postgres pg_dump -U postgres -d $db \
    | gzip > /tmp/${db}.sql.gz
done
```

Copy `/tmp/*.sql.gz` off-box via `pscp`.

### 10.3 Quick rollback to the Sept 15 backup

(Keep this until the next clean baseline. See `dist_linux/ROLLBACK-GUIDE.md`
for the long version.)

```bash
cd /var/www/boldreports/adhoc-embeeded
sudo docker compose -p bdsadhoc down
sudo docker load -i bdsadhoc-app-BACKUP-sep15.tar
sudo docker tag bdsadhoc-app:backup-sep15-prebuild bdsadhoc-app:latest
sudo cp -f .env.sep15-backup                 .env
sudo cp -f docker-compose.yml.sep15-backup   docker-compose.yml
sudo cp -f nginx/nginx.conf.sep15-backup     nginx/nginx.conf
sudo cp -f nginx/default.conf.sep15-backup   nginx/default.conf
sudo docker compose -p bdsadhoc up -d
```

### 10.4 Full teardown

```bash
sudo docker compose -p bdsadhoc down -v
sudo docker network rm bdsadhoc-net  || true
sudo docker volume  rm bdsadhoc-postgres-data bdsadhoc-nginx-cache || true
# Removes ONLY BDSAdhoc resources — host's boldreports / keycloak untouched.
```

---

## 11. Security checklist

- [x] `bdsadhoc-postgres` is on `bdsadhoc-net`; host port `5432` is admin-only.
      App reaches it via Docker DNS: `postgres:5432`.
- [x] App listens on `:8080` inside the docker network only.
- [x] Only `bdsadhoc-nginx` is bound to the host (`127.0.0.1:8085`).
- [x] Public access forces HTTPS (handled by the existing `boldreports` nginx).
- [x] Rate limiting (100 r/s) and security headers are set in
      `nginx/nginx.prod.conf` (use that file if you switch back to the
      TLS-on-this-stack variant — for the loopback-only variant see
      `nginx/nginx.conf`).
- [x] `.env` mode is `0600`, owned by `syncfusion`.
- [x] Image runs as non-root (`$APP_UID`).
- [x] Stack project name `bdsadhoc` is fully isolated from `boldreports`,
      `keycloak`, etc.

Things you should still do before opening this to the public:

- [ ] Rotate `POSTGRES_PASSWORD`
- [ ] Rotate `BR_*` and `BBI_*` admin passwords in `app.boldreports.com`
- [ ] Restrict host firewall to allow `:8085` only from
      `127.0.0.1` (the existing nginx reverse-proxies in local-only mode)
- [ ] Schedule TLS certificate renewal (not applicable to this stack — the
      `boldreports` host handles TLS).
- [ ] Off-host backup of `bdsadhoc-postgres-data` volume.

---

## Appendix A — full file tree shipped to VM

```
/var/www/boldreports/adhoc-embeeded/
├── docker-compose.yml                ← 3-service stack (postgres, app, nginx)
├── docker-compose.yml.sep15-backup
├── docker-compose.local-test.yml     ← used only on Windows for local smoke-test
├── .env                              ← production secrets (chmod 600)
├── .env.sep15-backup
├── bdsadhoc-app.tar                  ← latest saved image (after `docker save`)
├── bdsadhoc-app-BACKUP-sep15.tar     ← pre-Sept 15 image
├── ROLLBACK-GUIDE.md
├── nginx/
│   ├── nginx.conf                    ← current loopback / port 8085
│   ├── nginx.conf.sep15-backup
│   ├── default.conf                  ← reverse-proxy rules
│   ├── default.conf.sep15-backup
│   ├── nginx.prod.conf               ← TLS-8443 variant (future)
│   └── default.prod.conf             ← TLS-8443 variant (future)
└── sql/
    ├── 00_init_all_crm.sql           ← mounted into /docker-entrypoint-initdb.d
    ├── crm_schema.sql
    ├── crm_alphacorp_seed.sql
    ├── crm_betasolutions_seed.sql
    ├── crm_deltaenterprises_seed.sql
    ├── crm_gammaindustries_seed.sql
    └── seed_crm_databases.py         ← seed helper (optional)
```

**Repo source** (e.g. on Windows: `D:\GitHub\BDSAdhoc\dist_linux\…`) maps
**one-to-one** to the directory above. Mirror the tree, do not mix
production files with development.

---

**Document version:** 2026-09-16
**Stack version:** `bdsadhoc` (compose project) — 3 containers (postgres, app, nginx)
