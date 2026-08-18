# Bold BI & Bold Reports - Common Container Deployment Guide

Based on official Syncfusion documentation for Bold BI and Bold Reports container deployments.

---

## 1. Architecture Overview

### Single vs Multiple Container Deployments

| Aspect | Single Container | Multiple Container |
|--------|------------------|-------------------|
| **Use Case** | Small deployments, testing | Production, scalability |
| **Nginx** | Embedded in Bold Reports | Separate reverse proxy container |
| **Scalability** | Limited | High (horizontal scaling) |
| **Configuration** | Simple | More complex |

---

## 2. Docker Prerequisites

### Hardware Requirements (per service)

**Minimum:**
- **Memory:** 4 GB RAM per container
- **CPU:** 2-core processor

**Recommended (for Bold BI & Bold Reports together):**
- **Memory:** 8+ GB RAM
- **CPU:** 4+ cores
- **Storage:** 50+ GB (includes app data and database)

### Software Requirements

- **Docker:** Latest version (v20.10+)
- **Docker Compose:** v1.29+
- **Operating System:** Linux, Windows, or macOS
- **Database:** PostgreSQL (recommended for production)

---

## 3. Multiple Container Deployment (Production Architecture - Recommended)

### Docker Compose Setup Steps

#### Step 1: Create Project Directory
```bash
mkdir my_boldreports
cd my_boldreports
```

#### Step 2: Download Configuration Files
```bash
# Download docker-compose.yml
curl -o docker-compose.yml \
  "https://raw.githubusercontent.com/boldreports/bold-reports-docker/refs/heads/master/deploy/multiple-container/docker-compose.yml"

# Download Nginx configuration
curl -o default.conf \
  "https://raw.githubusercontent.com/boldreports/bold-reports-docker/refs/heads/master/deploy/multiple-container/default.conf"
```

#### Step 3: Configure Base URL
Replace `<app_base_url>` in docker-compose.yml with:

**Options:**
- `http://example.com` (DNS)
- `https://example.com` (DNS with HTTPS)
- `http://<public_ip_address>` (Public IP - NOT localhost)
- `http://host.docker.internal` (Docker Desktop local access)

⚠️ **Important Notes:**
- Use **public IP**, not internal/local IP (containers can't access internal IPs)
- Use `host.docker.internal` instead of `localhost` for Docker Desktop
- Ensure HTTP or HTTPS scheme is included
- Map the DNS name in `/etc/hosts` (Linux/Mac) or `C:\Windows\System32\drivers\etc\hosts` (Windows)

#### Step 4: Configure Data Paths

```yaml
volumes:
  boldservices_data:
    driver: local
    driver_opts:
      type: 'none'
      o: 'bind'
      device: '/var/boldreports/boldservices_data'  # Linux
      # device: 'D:/boldreports/boldservices_data'  # Windows

  db_data:
    driver: local
    driver_opts:
      type: 'none'
      o: 'bind'
      device: '/var/boldreports/db_data'            # Linux
      # device: 'D:/boldreports/db_data'            # Windows
```

#### Step 5: Mount Nginx Configuration
```yaml
services:
  nginx:
    volumes:
      - "<default_conf_path>:/etc/nginx/conf.d/default.conf"
      # Example Windows:
      # - "D:/boldreports/docker/default.conf:/etc/nginx/conf.d/default.conf"
      # Example Linux:
      # - "/var/boldreports/docker/default.conf:/etc/nginx/conf.d/default.conf"
```

#### Step 6: Change Port (Optional)
Modify port mappings if default port 80 is in use:
```yaml
ports:
  - "8080:80"  # Maps container port 80 to host port 8080
```

#### Step 7: Deploy
```bash
docker-compose up -d
```

---

## 4. Bold BI Container Deployment

### Key Configuration

```yaml
boldbi:
  image: syncfusion/boldbi:latest
  ports:
    - "8075:80"
  environment:
    - ASPNETCORE_ENVIRONMENT=Production
    # Embedded database (not recommended for production)
    # OR point to external PostgreSQL
    - DB_HOST=postgres
    - DB_PORT=5432
    - DB_USER=boldbi
    - DB_PASSWORD=<password>
  volumes:
    - boldbi_app_data:/application/app_data
  depends_on:
    - postgres
  networks:
    - bds-network
```

### ECS (AWS) Deployment

**Task Definition:**
- **Compatibility:** Fargate
- **OS Family:** Linux
- **Memory:** 4 GB RAM
- **CPU:** 2-core
- **Container Port:** 80 (TCP)
- **Storage Path:** `/application/app_data`

**Service Configuration:**
- **Launch Type:** Fargate (latest)
- **Desired Tasks:** 1+ (for scalability)
- **VPC/Subnet:** Same as Load Balancer and EFS
- **Load Balancer:** AWS Application Load Balancer with target group

---

## 5. Docker Volume Management

### Volume Types for Data Persistence

| Volume | Purpose | Location | Persistence |
|--------|---------|----------|-------------|
| `boldbi_app_data` | Bold BI application data | `/application/app_data` | ✅ Persistent |
| `boldreports_app_data` | Bold Reports application data | `/application/app_data` | ✅ Persistent |
| `db_data` | PostgreSQL database | `/var/lib/postgresql/data` | ✅ Persistent |
| `nginx_data` | Nginx configuration | `/etc/nginx/sites-available` | ✅ Persistent |

### Volume Best Practices

1. **Use named volumes** for managed persistence:
   ```yaml
   volumes:
     boldbi_app_data:
       driver: local
   ```

2. **Bind mounts** for host-based storage:
   ```yaml
   volumes:
     - /var/boldbi/app_data:/application/app_data
   ```

3. **Always map external directories** to survive container restarts:
   ```yaml
   device: '/mnt/storage/boldbi_data'
   ```

---

## 6. Networking Configuration

### Docker Network Setup

```yaml
networks:
  bds-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: br-bds
```

### Service Communication

**Within Docker Network:**
- Service name = hostname (e.g., `http://boldbi:80`)
- Direct container-to-container communication
- No port exposure needed

**From Host Machine:**
- Use mapped ports (e.g., `http://localhost:8075`)
- Use `host.docker.internal` for reverse communication
- NOT accessible via internal IP

---

## 7. Deployment Checklist

### Pre-Deployment

- [ ] Docker and Docker Compose installed
- [ ] Minimum 4GB RAM available per container
- [ ] Storage directory created and permissions set
- [ ] SSL certificates ready (if using HTTPS)
- [ ] DNS/IP address configured
- [ ] Port availability verified (80, 443, 8080, etc.)
- [ ] PostgreSQL version compatible (12+)

### Post-Deployment

- [ ] Services running: `docker-compose ps`
- [ ] Access via browser at configured URL
- [ ] SSL certificate working (if HTTPS)
- [ ] Database connection verified
- [ ] Application logs checked: `docker-compose logs`
- [ ] Data persistence tested (restart container)
- [ ] Performance monitoring configured

### Maintenance

- [ ] Regular backups of `app_data` volumes
- [ ] Database backups configured
- [ ] SSL certificate renewal scheduled
- [ ] Resource monitoring (CPU, memory, disk)
- [ ] Log rotation configured
- [ ] Update images periodically: `docker-compose pull`

---

## 8. Common Issues & Solutions

### Issue: "Cannot reach localhost from container"
**Solution:** Use `http://host.docker.internal` instead of `http://localhost`

### Issue: "Permission denied on mount directory"
**Solution:** Ensure mount directories have proper permissions:
```bash
chmod -R 755 /var/boldbi/app_data
chmod -R 755 /var/boldreports/app_data
```

### Issue: "Port already in use"
**Solution:** Change mapped port in docker-compose.yml:
```yaml
ports:
  - "8080:80"  # Changed from 80:80
```

### Issue: "SSL certificate mismatch"
**Solution:** Ensure certificate matches the base URL domain in configuration

### Issue: "Database connection failed"
**Solution:** Verify database service is healthy:
```bash
docker-compose ps  # Check DB status
docker-compose logs postgres  # View DB logs
```

---

## 9. Reference Links

### Bold BI Documentation
- **Docker Deployment:** https://help.boldbi.com/deploying-bold-bi/deploying-on-docker/
- **System Configuration:** https://help.boldbi.com/deploying-bold-bi/deploying-on-docker/recommended-system-configuration/
- **ECS Deployment:** https://help.boldbi.com/deploying-bold-bi/deploying-on-ecs/

### Bold Reports Documentation
- **Docker Deployment:** https://github.com/boldreports/bold-reports-docker
- **Docker Hub Image:** https://hub.docker.com/r/syncfusion/boldreports
- **SSL Configuration:** https://github.com/bold-reports/bold-reports-docker/blob/master/docs/ssl-termination.md

### Docker Best Practices
- **Docker Volumes:** https://docs.docker.com/storage/volumes/
- **Docker Networks:** https://docs.docker.com/network/
- **Compose Specification:** https://docs.docker.com/compose/compose-file/

---

## 10. Your Current BoldAdhocEmbed Deployment

Based on your `docker-compose.yml`:

✅ **Correctly Configured:**
- Multi-container architecture with network isolation
- PostgreSQL for data persistence
- Volume mapping for application data
- Bold Reports and Bold BI pointing to cloud services
- CORS and auth configured for frontend

📌 **Production Recommendations:**
1. Use SSL certificates for HTTPS
2. Configure load balancer in front of backend service
3. Implement database backups
4. Monitor container resource usage
5. Set up log aggregation
6. Consider Kubernetes for advanced orchestration

---

**Last Updated:** August 18, 2026
**Source:** Syncfusion Official Documentation
