# BDSAdhoc Linux Deployment — app.boldreportsdemo.com

End-to-end guide for hosting the **embedded app + Postgres** on the existing
**boldbi-presale-vm** (Ubuntu 24.04 LTS, kernel 6.17). The stack is **fully
namespaced** so it does NOT touch any of the host's existing containers
(Keycloak, boldreports, reportserver_pgdb, keycloak-postgres, etc.).

---

## ⚠️ Important: shared host

This VM already runs:

| Container             | Image                                                                                | Notes                                 |
|-----------------------|--------------------------------------------------------------------------------------|---------------------------------------|
| `keycloak`            | `quay.io/keycloak/keycloak:26.0`                                                     | Bound to `127.0.0.1:8080`             |
| `keycloak-postgres`   | `postgres:16`                                                                        | Network-only                          |
| `boldreports`         | `us-docker.pkg.dev/boldreports-dev/images/boldreports-single-docker:11.1.11...`      | **Bound to host port 443 + 8090**     |
| `reportserver_pgdb_1` | `postgres`                                                                           | Network-only                          |

**Conflict avoidance:**
- Container, volume, and network names all use the `bdsadhoc-t1-` prefix
- The new docker network is `bdsadhoc-t1-net` (separate from any existing)
- The new nginx binds **8080 (HTTP) and 8443 (HTTPS)** on the host, NOT 443
- URL to access the app: **`https://app.boldreportsdemo.com:8443`**

---

## Stack at a glance

```
        Internet
            │  8080 / 8443
            ▼
┌──────────────────────────────┐
│  bdsadhoc-t1-nginx           │  TLS terminator + reverse proxy
│  nginx:1.27-alpine           │  HSTS, http2, gzip, rate limit, static cache
└──────────┬───────────────────┘
           │  http://bdsadhoc:8080
           ▼
┌──────────────────────────────┐
│  bdsadhoc-t1-app             │  .NET 10 + React/Vite SPA
│  bdsadhoc-bdsadhoc:latest    │  single image, listens on :8080
└──────────┬───────────────────┘
           │  Npgsql
           ▼
┌──────────────────────────────┐
│  bdsadhoc-t1-postgres        │  postgres:16-alpine
│  4 tenant DBs auto-seeded    │  alphacorp, betasolutions,
│                              │  deltaenterprises, gammaindustries
└──────────────────────────────┘
```

---

## 1. Verify VM state (no install needed — Docker already present)

You already have Docker 29.7.2. Verify on the VM:

```bash
docker --version          # Docker version 29.7.2 ...
docker compose version    # Docker Compose version v2.x ...
docker ps                 # should show 4 existing containers — LEAVE THEM ALONE
```

> Do **not** run `docker system prune` or any cleanup command — it would
> delete the host's existing containers and volumes.

---

## 2. Copy the project to the VM

**On Windows (PowerShell), from `D:\GitHub\BDSAdhoc`:**

```powershell
tar --exclude='node_modules' --exclude='bin' --exclude='obj' `
    --exclude='*.user' --exclude='.git' `
    -czf bdsadhoc.tar.gz `
    BoldAdhocEmbed.slnx BoldAdhocEmbed.Server boldadhocembed.client `
    nginx sql docker-compose.prod.yml deploy.sh .env.prod.example `
    nginx/nginx.prod.conf nginx/default.prod.conf
```

**Upload + extract on the VM (PuTTY pscp / WinSCP):**

```bash
# (upload bdsadhoc.tar.gz to /home/syncfusion/ via WinSCP)
mkdir -p ~/bdsadhoc
tar -xzf ~/bdsadhoc.tar.gz -C ~/bdsadhoc
cd ~/bdsadhoc
ls   # you should see docker-compose.prod.yml, deploy.sh, sql/, nginx/, etc.
```

---

## 3. Place your TLS certificate

Recommended path on the VM (must already exist; supply your own `.pem` files):

```bash
sudo mkdir -p /etc/letsencrypt/app.boldreportsdemo.com
# Upload via WinSCP into that folder:
#   /etc/letsencrypt/app.boldreportsdemo.com/fullchain.pem
#   /etc/letsencrypt/app.boldreportsdemo.com/privkey.pem
sudo chmod 644 /etc/letsencrypt/app.boldreportsdemo.com/fullchain.pem
sudo chmod 600 /etc/letsencrypt/app.boldreportsdemo.com/privkey.pem
sudo chown root:root /etc/letsencrypt/app.boldreportsdemo.com/*.pem

# Sanity check
openssl x509 -in /etc/letsencrypt/app.boldreportsdemo.com/fullchain.pem -noout -subject -dates
```

> `fullchain.pem` must contain the leaf cert **plus** the chain. `privkey.pem`
> must be the matching unencrypted private key.

---

## 4. Create `.env.prod`

```bash
cd ~/bdsadhoc
cp .env.prod.example .env.prod
nano .env.prod
```

**Change only these:**

```ini
POSTGRES_PASSWORD=<a strong random string, 24+ chars>
TLS_CERT_FULLCHAIN_PATH=/etc/letsencrypt/app.boldreportsdemo.com/fullchain.pem
TLS_CERT_KEY_PATH=/etc/letsencrypt/app.boldreportsdemo.com/privkey.pem
```

Save (`Ctrl-O`, `Enter`, `Ctrl-X`) and lock down:

```bash
chmod 600 .env.prod
```

---

## 5. First deploy

```bash
cd ~/bdsadhoc
chmod +x deploy.sh
./deploy.sh --logs
```

**What it does:**

1. Pre-flight: checks Docker, `docker compose`, `.env.prod`, cert files
2. Builds `bdsadhoc-bdsadhoc:latest` from `BoldAdhocEmbed.Server/Dockerfile` (if missing)
3. Runs `docker compose -p bdsadhoc-t1 -f docker-compose.prod.yml up -d`
4. Waits for `bdsadhoc-t1-postgres` to be `healthy` (~30s on first run while
   the 5 SQL files in `./sql` initialize the 4 tenant DBs)
5. Waits for the app to respond on `https://app.boldreportsdemo.com:8443`
6. Runs four smoke tests (health, SPA, /api/crm/deals, HTTP→HTTPS redirect)
7. Tails logs (Ctrl-C to leave; containers keep running)

**Expected output on first run:**

```
[14:01:23] Building bdsadhoc-bdsadhoc:latest from Dockerfile...
... vite build, dotnet publish, image export ...
[14:03:11] Starting BDSAdhoc stack (project: bdsadhoc-t1)...
[14:03:11] Waiting for bdsadhoc-t1-postgres to become healthy...
[14:03:25] Postgres is healthy.
[14:03:25] Waiting for app to respond on https://app.boldreportsdemo.com:8443...
[14:03:31] App is responding on HTTPS.
[14:03:31] Running smoke tests...
  - /health  ........... 200
  - / (SPA)  .......... 200
  - /api/crm/deals ... 200
  - HTTP redirect .... HTTP 301 -> https://app.boldreportsdemo.com:8080/
```

---

## 6. Verify in a browser

Open **`https://app.boldreportsdemo.com:8443`** — you should see the React
dashboard with a valid padlock. Log in as `alpha1@alphacorp.com` to confirm
the seeded tenant data loads.

To confirm the existing services still work, open:
- `https://<vm-public-ip>:8090` — should still be the existing boldreports
- `http://127.0.0.1:8080` — should still be Keycloak (only on loopback)

---

## 7. Day-to-day operations

> All commands assume `cd ~/bdsadhoc`.

### Rebuild & refresh after a code change
```bash
./deploy.sh --build
```

### Tail logs
```bash
docker compose -p bdsadhoc-t1 -f docker-compose.prod.yml --env-file .env.prod logs -f
# or one service:
docker logs -f bdsadhoc-t1-app
```

### List ONLY your stack's containers
```bash
docker ps --filter "name=bdsadhoc-t1-"
```

### Rotate TLS certificate (no restart, no downtime)
```bash
# 1. Drop the new .pem/.key files into /etc/letsencrypt/app.boldreportsdemo.com/
# 2. Reload nginx:
./deploy.sh --restart-nginx
```

### Stop / start the stack
```bash
./deploy.sh --stop                                       # stop
docker compose -p bdsadhoc-t1 -f docker-compose.prod.yml --env-file .env.prod start   # start
```

### Reset the database (DESTROYS all tenant data)
```bash
docker compose -p bdsadhoc-t1 -f docker-compose.prod.yml --env-file .env.prod down -v
./deploy.sh                                              # postgres re-inits from /docker-entrypoint-initdb.d
```

### Update the app image from a registry
```bash
./deploy.sh --pull
```

### Full teardown (remove stack + volumes)
```bash
docker compose -p bdsadhoc-t1 -f docker-compose.prod.yml --env-file .env.prod down -v
docker network rm bdsadhoc-t1-net
```
This only removes the bdsadhoc-t1 stack — the host's other containers
(keycloak, boldreports, etc.) are untouched.

---

## 8. Port & resource summary

| Container              | Host port | Internal port | Network                |
|------------------------|-----------|---------------|------------------------|
| `bdsadhoc-t1-postgres` | —         | 5432          | `bdsadhoc-t1-net` only |
| `bdsadhoc-t1-app`      | —         | 8080          | `bdsadhoc-t1-net` only |
| `bdsadhoc-t1-nginx`    | **8080**  | 80            | `bdsadhoc-t1-net`      |
| `bdsadhoc-t1-nginx`    | **8443**  | 443           | `bdsadhoc-t1-net`      |

To reclaim host port 443 for the bdsadhoc stack (e.g. when the existing
`boldreports` container is decommissioned), edit `docker-compose.prod.yml`
nginx service `ports:` — change `"8443:443"` to `"443:443"`, then
`./deploy.sh --build`.

---

## 9. File map (what was created)

```
BDSAdhoc/
├── docker-compose.prod.yml       # Slim prod stack (postgres + app + nginx)
├── deploy.sh                     # One-shot deploy / refresh / logs
├── .env.prod.example             # Template — copy to .env.prod
├── LINUX-DEPLOYMENT.md           # This file
├── nginx/
│   ├── nginx.prod.conf           # Master config (TLS, http2, gzip)
│   └── default.prod.conf         # Server block for app.boldreportsdemo.com
└── (existing BoldAdhocEmbed.Server/ + boldadhocembed.client/ + sql/)
```

The original `docker-compose.yml` (with Bold BI/Reports for local Windows
dev) is untouched.

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `404` from `/api/crm/deals` | Tenant DB not seeded yet | First run takes ~30s; `docker logs bdsadhoc-t1-postgres` — look for `PostgreSQL init process complete` |
| Browser shows `NET::ERR_CERT_AUTHORITY_INVALID` | Wrong cert / chain | Re-export cert **with chain** (fullchain.pem, not cert.pem) |
| App loops with `Connection refused` to postgres | `POSTGRES_PASSWORD` mismatch between .env and seed | Match the value; if you've already initialised, `down -v` and redeploy |
| `nginx: [emerg] cannot load certificate` | Wrong path in `.env.prod` | Update `TLS_CERT_*_PATH`; check perms are 600/644 |
| 502 Bad Gateway from nginx | App container not healthy | `docker logs bdsadhoc-t1-app`; check `ASPNETCORE_URLS` is `:8080` |
| Browser can't connect on port 8443 | GCP firewall/security-group blocks 8443 | Open TCP 8080 + 8443 inbound on the VM's firewall |
| Port 8443 in use by something else | Another container on host | `sudo ss -tlnp 'sport = :8443'` to find the owner; pick a different port |
| Existing `boldreports` started failing after our deploy | We accidentally bound same port | Check `docker ps` — our nginx binds 8080/8443, not 443/8090. Should not happen. |

---

## 11. Security checklist

- [x] Postgres port 5432 is **not** exposed to the host (internal docker network only)
- [x] App listens on 8080 inside docker only — only nginx can reach it
- [x] TLS 1.2 + 1.3 only, HSTS enabled, OCSP stapling on
- [x] Rate limiting on `/api/` (100 r/s, burst 100)
- [x] Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [x] `.env.prod` is `chmod 600`
- [x] App runs as non-root inside container (ASP.NET image uses `$APP_UID`)
- [x] Stack uses project name `bdsadhoc-t1` — fully isolated from host's other containers
- [ ] Rotate `POSTGRES_PASSWORD` and Bold Reports / BI secrets before going public
- [ ] Open host firewall rules for TCP 8080 + 8443
- [ ] Set up automated TLS renewal if your cert is short-lived
- [ ] Configure off-host backups of the `bdsadhoc-t1-postgres-data` volume
