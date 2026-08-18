# BDSAdhoc - Multi-Container Deployment

Syncfusion Bold BI and Bold Reports integrated adhoc reporting application with Docker multi-container deployment.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop (v29.5+)
- Docker Compose (v5.1+)
- Windows PowerShell 5.1+

### Run the Application

```powershell
# Navigate to project directory
cd d:\GitHub\BDSAdhoc

# Start all services
docker compose up -d

# Wait 30-60 seconds for services to initialize
Start-Sleep -Seconds 60
```

## 📊 Access Applications

| Service | URL | Purpose |
|---------|-----|---------|
| **Main Application** | http://localhost:5050 | React frontend + .NET backend |
| **Bold BI** | http://localhost:8080 | Business Intelligence dashboards |
| **Bold Reports** | http://localhost:8081 | Report designer & viewer |

## 🛑 Stop the Application

```powershell
# Stop all services (keep data)
docker compose down

# Stop and remove all data
docker compose down -v
```

## 📋 Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Docker Compose Network                 │
├─────────────────────────────────────────────────────────┤
│  Port 5050     Port 8080      Port 8081                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐          │
│  │  Main    │  │  Bold    │  │ Bold Reports │          │
│  │  App     │  │   BI     │  │              │          │
│  │ (:8080)  │  │ (:80)    │  │    (:80)     │          │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘          │
│       │             │               │                  │
│       └─────────────┼───────────────┘                  │
│                     │                                  │
│           ┌─────────▼──────────┐                      │
│           │  PostgreSQL (5432) │                      │
│           │    (Internal Only)  │                      │
│           └────────────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

## 🔧 Services

### Main Application (Port 5050)
- React frontend
- .NET Core backend API
- Dashboard embedding
- Report embedding

### Bold BI (Port 8080)
- Cloud-based dashboards
- Data visualization
- Analytics platform

### Bold Reports (Port 8081)
- Cloud-based reports
- Report designer
- Report scheduling

### PostgreSQL (Internal)
- Database for Bold services
- Internal network only
- Auto-initialized on startup

## 📁 Project Structure

```
BDSAdhoc/
├── docker-compose.yml          # Multi-container orchestration
├── deploy-multicontainer.ps1   # PowerShell deployment script
├── BoldAdhocEmbed.Server/      # .NET Core backend
│   ├── Controllers/            # API endpoints
│   ├── Services/               # Business logic
│   ├── Models/                 # Data models
│   └── Dockerfile              # Backend container image
├── boldadhocembed.client/      # React frontend
│   ├── src/                    # Source code
│   ├── public/                 # Static files
│   └── package.json            # Dependencies
├── nginx/                       # Nginx configuration
│   ├── default.conf            # Reverse proxy rules
│   └── nginx.conf              # Nginx config
└── CONTAINER-DEPLOYMENT-GUIDE.md  # Detailed documentation
```

## 🔐 Configuration

Environment variables are in `BoldAdhocEmbed.Server/Program.cs`:

- **Bold Reports API**: Cloud-based (https://cloud.boldreports.com)
- **Bold BI API**: Cloud-based (https://cloud.boldbi.com)
- **Database**: PostgreSQL 16 (internal)

## 📝 Logs

View service logs:

```powershell
# All services
docker compose logs -f

# Specific service
docker compose logs -f bdsadhoc-app
docker compose logs -f bdsadhoc-boldbi
docker compose logs -f bdsadhoc-boldreports
```

## ✅ Health Checks

All services include health checks. Verify status:

```powershell
docker compose ps
```

Status indicators:
- ✅ `Up (healthy)` - Service running normally
- ⏳ `Up (health: starting)` - Service initializing
- ⚠️ `Up (unhealthy)` - Service has issues
- ❌ `Exited` - Service stopped or crashed

## 🐛 Troubleshooting

### Port Already in Use
If ports 5050, 8080, or 8081 are in use, modify `docker-compose.yml`:
```yaml
ports:
  - "YOUR_PORT:8080"  # Change first number
```

### Service Won't Start
Check logs:
```powershell
docker compose logs <service-name>
```

### Database Connection Issues
Verify PostgreSQL is healthy:
```powershell
docker compose ps postgres
```

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Bold BI Documentation](https://boldbi.syncfusion.com/documentation)
- [Bold Reports Documentation](https://boldreports.syncfusion.com/documentation)

---

**Last Updated:** August 18, 2026  
**Docker Compose Version:** v5.1.4  
**Docker Version:** 29.5.3
