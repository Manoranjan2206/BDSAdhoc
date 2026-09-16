# BDSAdhoc — Production Deployment Runbook & System Documentation

Complete, authoritative documentation of the production environment on **`boldbi-presale-vm`** (IP: `192.168.7.68`) hosting **ACME CRM Suite (BDSAdhoc)** at **`https://app.boldreportsdemo.com/`**.

---

## 1. System Architecture & Topology

```
                  Internet / Users
                         │
                         ▼
             Cloudflare (SSL Termination)
                         │  HTTPS (443)
                         ▼
             Host / VM (192.168.7.68)
        ┌───────────────────────────────────┐
        │  Host Nginx / Reverse Proxy       │
        │  Proxies: app.boldreportsdemo.com │
        │        ──► 127.0.0.1:8085         │
        └─────────────────┬─────────────────┘
                          │
     ┌────────────────────┴──────────────────────────┐
     │  Docker Compose Stack: `bdsadhoc`             │
     │  Network: `bdsadhoc-net` (bridge)             │
     │                                               │
     │  ┌─────────────────────────────────────────┐  │
     │  │  bdsadhoc-nginx (nginx:1.27-alpine)     │  │
     │  │  Listens: 127.0.0.1:8085 -> 80          │  │
     │  │  Upstream: http://bdsadhoc:8080         │  │
     │  └──────────────────┬──────────────────────┘  │
     │                     │                         │
     │  ┌──────────────────┴──────────────────────┐  │
     │  │  bdsadhoc-app (bdsadhoc-app:latest)     │  │
     │  │  ASP.NET Core 10 Web API + Vite React   │  │
     │  │  Listens: 8080 (internal only)          │  │
     │  └──────────────────┬──────────────────────┘  │
     │                     │ Npgsql (5432)           │
     │  ┌──────────────────┴──────────────────────┐  │
     │  │  bdsadhoc-postgres (postgres:16-alpine) │  │
     │  │  Multi-tenant DBs with RLS:             │  │
     │  │  crm_alphacorp, crm_betasolutions,      │  │
     │  │  crm_deltaenterprises,                  │  │
     │  │  crm_gammaindustries                    │  │
     │  └─────────────────────────────────────────┘  │
     └───────────────────────────────────────────────┘
```

---

## 2. Server & Environment Specifications

| Parameter | Production Value |
|---|---|
| **Hostname** | `boldbi-presale-vm` |
| **Private IP** | `192.168.7.68` |
| **Public URL** | `https://app.boldreportsdemo.com/` |
| **SSH User** | `syncfusion` |
| **SSH Key** | `D:/gcp-boldbi-presale-vm.ppk` |
| **Deployment Root** | `/var/www/boldreports/adhoc-embeeded/` |
| **Docker Compose Project** | `bdsadhoc` |
| **Docker Network** | `bdsadhoc-net` |
| **Database Port** | `127.0.0.1:5432` (or internal network `postgres:5432`) |
| **Nginx Entry Port** | `127.0.0.1:8085` (host bound) |
| **Application Internal Port** | `8080` (container internal, **never** bind 5050 to host) |

---

## 3. Directory Layout on VM (`/var/www/boldreports/adhoc-embeeded/`)

```
/var/www/boldreports/adhoc-embeeded/
├── docker-compose.yml           # Active production Compose file
├── .env                         # Production environment secrets (chmod 600)
├── nginx/
│   ├── nginx.conf               # Master Nginx configuration (gzip, buffer, upstream)
│   └── default.conf             # Virtual host proxy rules (proxies / to app:8080)
└── sql/
    ├── 00_init_all_crm.sql      # Entry point for PostgreSQL auto-seeding
    ├── crm_schema.sql           # Schema definition with RLS policies & indexes
    ├── crm_alphacorp_seed.sql
    ├── crm_betasolutions_seed.sql
    ├── crm_deltaenterprises_seed.sql
    └── crm_gammaindustries_seed.sql
```

---

## 4. Production Configuration Files

### 4.1 `docker-compose.yml` (Working Production Reference)

```yaml
services:
  # ---------------------------------------------------------------------------
  # 1. PostgreSQL Database Service
  # ---------------------------------------------------------------------------
  postgres:
    image: postgres:16-alpine
    container_name: bdsadhoc-postgres
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-Password123!}
      POSTGRES_INITDB_ARGS: "-c max_connections=200"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql:/docker-entrypoint-initdb.d:ro
    ports:
      - "0.0.0.0:5432:5432"
    networks:
      - bdsadhoc-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # 2. BDSAdhoc Application (.NET 10 + React SPA)
  # ---------------------------------------------------------------------------
  bdsadhoc:
    image: bdsadhoc-app:latest
    container_name: bdsadhoc-app
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ASPNETCORE_URLS: http://+:8080

      # Postgres connection parameters
      POSTGRES_HOST: postgres
      POSTGRES_PORT: "5432"
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-Password123!}

      # Bold Reports Configuration
      BoldReports__ReportRootUrl: ${BR_ReportRootUrl}
      BoldReports__ReportsSiteIdentifier: ${BR_SiteIdentifier}
      BoldReports__AdminUser: ${BR_AdminUser}
      BoldReports__AdminPassword: ${BR_AdminPassword}
      BoldReports__EmbedSecret: ${BR_EmbedSecret}

      # Bold BI Configuration
      BoldBI__ServerUrl: ${BBI_ServerUrl}
      BoldBI__SiteIdentifier: ${BBI_SiteIdentifier}
      BoldBI__AdminUser: ${BBI_AdminUser}
      BoldBI__AdminPassword: ${BBI_AdminPassword}
      BoldBI__EmbedSecret: ${BBI_EmbedSecret}
      BoldBI__UserEmail: ${BBI_UserEmail}
      BoldBI__Environment: ${BBI_Environment:-onpremise}
    networks:
      - bdsadhoc-net
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080/api/crm/home-summary?email=alpha1@alphacorp.com"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # 3. Nginx Reverse Proxy
  # ---------------------------------------------------------------------------
  nginx:
    image: nginx:1.27-alpine
    container_name: bdsadhoc-nginx
    restart: always
    depends_on:
      - bdsadhoc
    ports:
      - "127.0.0.1:8085:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - nginx_cache:/var/cache/nginx
    networks:
      - bdsadhoc-net
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  bdsadhoc-net:
    name: bdsadhoc-net
    driver: bridge

volumes:
  postgres_data:
    name: bdsadhoc-postgres-data
  nginx_cache:
    name: bdsadhoc-nginx-cache
```

### 4.2 `.env` (Production Values)

```ini
# ---- PostgreSQL Database ----
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

> **Crucial Rule:** `BR_EmbedSecret` and `BBI_EmbedSecret` MUST be different. If they match, the backend startup validation throws `InvalidOperationException` and exits.

---

## 5. Standard Deployment Workflow (Future Releases)

Whenever you prepare a new build locally and want to push to production:

### Step 1: On Local Windows machine
```powershell
# 1. Package the image
docker save bdsadhoc-app:latest | gzip > bdsadhoc-app.tar.gz

# 2. Upload to the VM directly into the production directory
pscp -i "D:/gcp-boldbi-presale-vm.ppk" bdsadhoc-app.tar.gz syncfusion@192.168.7.68:/var/www/boldreports/adhoc-embeeded/
```

### Step 2: On the Linux VM
```bash
cd /var/www/boldreports/adhoc-embeeded

# 1. Load the new Docker image
sudo docker load -i ./bdsadhoc-app.tar.gz

# 2. Recreate ONLY the application container (Zero DB downtime, Nginx keeps running)
sudo docker compose -p bdsadhoc up -d --force-recreate --no-deps bdsadhoc

# 3. Clean up the uploaded tarball
rm -f ./bdsadhoc-app.tar.gz

# 4. Verify deployment
curl -fsS http://127.0.0.1:8085/health
curl -kI https://app.boldreportsdemo.com/
```

---

## 6. Verification & Troubleshooting Commands

```bash
# View container status
sudo docker compose -p bdsadhoc ps

# Tail application logs (inspect API calls, token generation, auth)
sudo docker logs -f bdsadhoc-app --tail 100

# Tail Nginx reverse proxy logs
sudo docker logs -f bdsadhoc-nginx --tail 50

# Test database connection and count records
sudo docker exec -it bdsadhoc-postgres psql -U postgres -d crm_alphacorp -c \
  "SELECT 'contacts' as tbl, count(*) FROM contacts UNION ALL SELECT 'deals', count(*) FROM deals;"

# Restart entire stack without data loss
sudo docker compose -p bdsadhoc restart

# Full restart (down + up, preserves database volume)
sudo docker compose -p bdsadhoc down
sudo docker compose -p bdsadhoc up -d
```

---

## 7. Cleanup Commands (Delete All Backup Files)

Over multiple iterations, backup files were created on the server. Run these commands to safely reclaim disk space while keeping your working production files intact.

### 7.1 Delete backup files in `/var/www/boldreports/adhoc-embeeded/`

```bash
cd /var/www/boldreports/adhoc-embeeded

# List all backup files before deleting (review first)
ls -la *.before* *.backup* *.tar *.tar.gz 2>/dev/null

# Remove old tar archives, backup compose files, and backup env files
sudo rm -f .env.before*
sudo rm -f .env.sep15-backup
sudo rm -f docker-compose.yml.before*
sudo rm -f docker-compose.yml.sep15-backup
sudo rm -f docker-compose.local-test.yml
sudo rm -f bdsadhoc-app.before*
sudo rm -f bdsadhoc-app.tar*
sudo rm -f bdsadhoc-app-BACKUP*.tar*
sudo rm -f nginx/nginx.conf.before*
sudo rm -f nginx/nginx.conf.sep15-backup
sudo rm -f nginx/default.conf.before*
sudo rm -f nginx/default.conf.sep15-backup
```

### 7.2 Delete temporary uploaded zip files in `/home/syncfusion/`

```bash
cd /home/syncfusion

# Remove the uploaded deployment zips and extracted temp files
rm -f bdsadhoc-docker-deploy-sept15.zip
rm -f bdsadhoc-docker-deploy.zip
rm -f bdsadhoc-app.tar.gz
rm -f bdsadhoc.tar.gz
rm -rf bdsadhoc-deploy/
rm -rf /var/www/boldreports/adhoc-embeeded-sept15/
```

### 7.3 Clean dangling Docker images (reclaims GBs of disk)

```bash
# Remove untagged / dangling images
sudo docker image prune -f
```

> ⚠️ **Warning:** Do **NOT** run `docker system prune -a` or `docker volume prune` as the VM also hosts Keycloak, Bold Reports, and other client POCs.
