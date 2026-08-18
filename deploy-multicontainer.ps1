# =========================================================================
# BoldAdhocEmbed Multi-Container Deployment Script (PowerShell)
# =========================================================================
# Quick-start script for deploying the multi-container architecture
# Usage: .\deploy-multicontainer.ps1 [Command] [Options]

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "restart", "status", "logs", "clean", "clean-volumes", "backup", "help")]
    [string]$Command = "help",

    [switch]$ForceRebuild,
    [switch]$VerboseOutput,
    [switch]$Follow
)

# Color functions
function Write-Header {
    param([string]$Message)
    Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

# Help function
function Show-Help {
    $help = @"
BoldAdhocEmbed Multi-Container Deployment

USAGE:
    .\deploy-multicontainer.ps1 [Command] [Options]

COMMANDS:
    start               Start all services (default)
    stop                Stop all services
    restart             Restart all services
    status              Show service status
    logs                Show service logs (use -Follow for live)
    clean               Remove containers (keeps data)
    clean-volumes       Remove containers AND volumes (deletes data!)
    backup              Backup database to SQL file
    help                Show this help message

OPTIONS:
    -ForceRebuild       Force rebuild of images
    -Follow             Follow logs in real-time
    -VerboseOutput      Verbose output

EXAMPLES:
    .\deploy-multicontainer.ps1 start
    .\deploy-multicontainer.ps1 logs -Follow
    .\deploy-multicontainer.ps1 backup

COMMON WORKFLOWS:

  First time setup:
    .\deploy-multicontainer.ps1 clean-volumes
    .\deploy-multicontainer.ps1 start
    .\deploy-multicontainer.ps1 logs -Follow

  Stop working:
    .\deploy-multicontainer.ps1 stop

  Restart after changes:
    .\deploy-multicontainer.ps1 restart -ForceRebuild

  Troubleshooting:
    .\deploy-multicontainer.ps1 logs
    .\deploy-multicontainer.ps1 status

"@
    Write-Host $help
}

# Check prerequisites
function Test-Prerequisites {
    Write-Header "Checking Prerequisites"

    # Check Docker
    try {
        $dockerVersion = docker --version
        Write-Success "Docker found: $dockerVersion"
    }
    catch {
        Write-Error-Custom "Docker is not installed or not in PATH"
        exit 1
    }

    # Check Docker Compose
    try {
        $composeVersion = docker-compose --version
        Write-Success "Docker Compose found: $composeVersion"
    }
    catch {
        Write-Error-Custom "Docker Compose is not installed"
        exit 1
    }

    # Check if docker daemon is running
    try {
        docker info > $null 2>&1
        Write-Success "Docker daemon is running"
    }
    catch {
        Write-Error-Custom "Docker daemon is not running"
        exit 1
    }

    # Check if we're in the right directory
    if (-not (Test-Path "docker-compose.yml")) {
        Write-Error-Custom "docker-compose.yml not found. Run from project root directory."
        exit 1
    }
    Write-Success "docker-compose.yml found"
}

# Create data directories
function New-DataDirectories {
    Write-Header "Creating Data Directories"

    $dirs = @(".\.data\postgres", ".\.data\boldbi", ".\.data\boldreports")

    foreach ($dir in $dirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Force -Path $dir > $null
            Write-Success "Created $dir"
        }
        else {
            Write-Info "$dir already exists"
        }
    }
}

# Start services
function Start-Services {
    Write-Header "Starting Services"

    if ($ForceRebuild) {
        Write-Warning "Rebuilding images (--force-rebuild)"
        docker-compose build --no-cache
    }
    else {
        Write-Info "Pulling latest images..."
        docker-compose pull
    }

    Write-Info "Starting services..."
    docker-compose up -d

    Write-Info "Waiting for services to become healthy..."
    Start-Sleep -Seconds 5

    Write-Success "Services started"
    Show-Status
}

# Stop services
function Stop-Services {
    Write-Header "Stopping Services"
    docker-compose down
    Write-Success "Services stopped"
}

# Restart services
function Restart-Services {
    Write-Header "Restarting Services"

    if ($ForceRebuild) {
        Write-Warning "Rebuilding images (--force-rebuild)"
        docker-compose build --no-cache
    }

    docker-compose restart
    Write-Success "Services restarted"
    Start-Sleep -Seconds 3
    Show-Status
}

# Show status
function Show-Status {
    Write-Header "Service Status"
    docker-compose ps

    Write-Header "Access Points"
    Write-Host "  Frontend:  http://localhost" -ForegroundColor Cyan
    Write-Host "  API:       http://localhost/api" -ForegroundColor Cyan
    Write-Host "  Bold BI:   http://localhost/bi" -ForegroundColor Cyan
    Write-Host "  Reports:   http://localhost/reports" -ForegroundColor Cyan

    # Check if services are running
    Write-Host ""
    $running = docker-compose ps | Select-String "bdsadhoc.*Up"
    if ($running) {
        Write-Success "Application is running at http://localhost"
    }
    else {
        Write-Warning "Application is not running yet"
    }
}

# Show logs
function Show-Logs {
    if ($Follow) {
        docker-compose logs -f
    }
    else {
        docker-compose logs --tail=50
    }
}

# Clean containers
function Clean-Containers {
    Write-Header "Cleaning Containers"
    Write-Warning "This will stop and remove containers but keep data"
    docker-compose down
    Write-Success "Containers removed (data preserved)"
}

# Clean volumes
function Clean-Volumes {
    Write-Header "Cleaning Everything (Volumes Included)"
    Write-Error-Custom "WARNING: This will DELETE all data!"
    $confirmation = Read-Host "Type 'yes' to confirm"

    if ($confirmation -eq "yes") {
        docker-compose down -v
        if (Test-Path ".\.data") {
            Remove-Item -Recurse -Force ".\.data"
        }
        Write-Success "All data removed"
    }
    else {
        Write-Info "Cancelled"
    }
}

# Backup database
function Backup-Database {
    Write-Header "Backing Up Database"

    $backupFile = "db_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

    Write-Info "Creating backup: $backupFile"
    docker exec bdsadhoc-postgres pg_dump -U postgres | Out-File -Encoding UTF8 $backupFile

    if (Test-Path $backupFile) {
        $fileInfo = Get-Item $backupFile
        Write-Success "Database backed up to: $backupFile ($(Format-FileSize $fileInfo.Length))"
    }
    else {
        Write-Error-Custom "Backup failed"
        exit 1
    }
}

# Helper function to format file size
function Format-FileSize {
    param([long]$bytes)
    if ($bytes -lt 1KB) { return "$bytes B" }
    elseif ($bytes -lt 1MB) { return [math]::Round($bytes / 1KB, 2).ToString() + " KB" }
    elseif ($bytes -lt 1GB) { return [math]::Round($bytes / 1MB, 2).ToString() + " MB" }
    else { return [math]::Round($bytes / 1GB, 2).ToString() + " GB" }
}

# Main execution
Write-Host ""
switch ($Command.ToLower()) {
    "help" {
        Show-Help
    }
    "start" {
        Test-Prerequisites
        New-DataDirectories
        Start-Services
    }
    "stop" {
        Test-Prerequisites
        Stop-Services
    }
    "restart" {
        Test-Prerequisites
        Restart-Services
    }
    "status" {
        Test-Prerequisites
        Show-Status
    }
    "logs" {
        Test-Prerequisites
        Show-Logs
    }
    "clean" {
        Test-Prerequisites
        Clean-Containers
    }
    "clean-volumes" {
        Test-Prerequisites
        Clean-Volumes
    }
    "backup" {
        Test-Prerequisites
        Backup-Database
    }
    default {
        Show-Help
        exit 1
    }
}

Write-Host ""
