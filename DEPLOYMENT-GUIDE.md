# BoldAdhocEmbed — Build, Zip, Deploy to Linux

This document describes the **end-to-end** process to build the BoldAdhocEmbed
application on a Windows machine, package it as a flat zip, push it to the
Linux host, and replace the running application.

The procedure replaces the previous build in full — no manual file shuffling
is required.

---

## 1. Overview

```text
Windows host                          Linux host (boldbi-presale-vm)
--------------                        --------------------------------
BoldAdhocEmbed repo                   /var/www/boldreports/adhoc/
   |                                  /etc/systemd/system/boldadhoc-adhoc.service
   v                                  /etc/nginx/sites-available/rls.boldreportsdemo.com
npm install + npm run build
dotnet publish -r linux-x64
   |
   v
./publish/                            (mirror, NOT a folder inside the zip)
   |
   v
BDSAdhoc/BoldAdhocEmbed-Linux-Deploy.zip   (FLAT layout, no nested publish/)
   |
   v
pscp ... -> /home/syncfusion/
   |
   v
sudo unzip -> /var/www/boldreports/adhoc/
systemctl restart boldadhoc-adhoc
```

> **Critical:** the zip MUST be **flat** (its root entries are the binary,
> `wwwroot/`, `appsettings*.json`, …). If the zip contains a nested
> `publish/` folder, systemd will fail with `status=203/EXEC` because
> `ExecStart` points at `/var/www/boldreports/adhoc/BoldAdhocEmbed.Server`.

---

## 2. Prerequisites

| Component | Version (verified) | Notes |
|---|---|---|
| Windows 10/11 | — | Build host |
| .NET SDK | 10.0.301 | `dotnet --version` |
| Node.js | v20.20.2 | `node --version` |
| npm | 11.7.0 | `npm --version` |
| PowerShell | 5.1+ | For zip + scp |
| PuTTY tools | `pscp.exe` | For SCP with a `.ppk` key |
| Linux host | Ubuntu 22.04+ | `unzip`, `systemd`, `nginx` |

---

## 3. Build on Windows

### 3.1 One-command automated build (recommended)

```bash
# From the repository root, in Git Bash / WSL / MSYS
./linux-publish.sh
```

The script performs:

1. Pre-flight checks (`dotnet`, `node`, `npm`).
2. Wipes the previous `./publish/` folder.
3. `npm install` + `npm run build` in `boldadhocembed.client/`.
4. `dotnet publish -c Release -r linux-x64 --self-contained true
   /p:PublishSingleFile=true /p:PublishReadyToRun=true /p:UseAppHost=true`
   into `./publish/`.
5. `chmod +x ./publish/BoldAdhocEmbed.Server`.
6. Mirrors `./publish/*` into `./deploy/adhoc/` and (if `zip` is available)
   produces a **flat** zip at:

   ```text
   D:\GitHub\BDSAdhoc\BoldAdhocEmbed-Linux-Deploy.zip
   ```

### 3.2 Manual build (equivalent)

```powershell
# 1. Build the client
cd "d:\GitHub\New folder\support-samples\CustomSample\Bold_Adhoc_Embed\boldadhocembed.client"
npm install
npm run build
cd ".."

# 2. Publish the server for Linux-x64
cd BoldAdhocEmbed.Server
dotnet publish BoldAdhocEmbed.Server.csproj `
    -c Release `
    -r linux-x64 `
    --self-contained true `
    -o "d:\GitHub\New folder\support-samples\CustomSample\Bold_Adhoc_Embed\publish" `
    /p:PublishSingleFile=true `
    /p:PublishReadyToRun=true `
    /p:UseAppHost=true
cd ".."
```

---

## 4. Zip the publish output (FLAT layout)

> The Linux target folder is `/var/www/boldreports/adhoc/`. The zip's root
> must contain `BoldAdhocEmbed.Server` directly, not a nested `publish/`
> folder.

### 4.1 Recommended: stage then zip

```powershell
$src  = "d:\GitHub\New folder\support-samples\CustomSample\Bold_Adhoc_Embed\publish"
$stg  = "d:\GitHub\New folder\support-samples\CustomSample\Bold_Adhoc_Embed\deploy\adhoc"
$zip  = "d:\GitHub\BDSAdhoc\BoldAdhocEmbed-Linux-Deploy.zip"

# Wipe staging & previous zip (replace, don't merge)
Remove-Item -Recurse -Force (Split-Path $stg) -ErrorAction SilentlyContinue
Remove-Item $zip -ErrorAction SilentlyContinue

# Mirror publish contents (not the publish/ folder itself) into staging
New-Item -ItemType Directory -Force -Path $stg | Out-Null
Copy-Item -Recurse -Force (Join-Path $src '*') $stg

# Create the flat zip (PowerShell 5.1+)
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stg, $zip)

Write-Host "Created: $zip"
```

### 4.2 Alternative: `Compress-Archive` (still flat)

```powershell
$src = "d:\GitHub\New folder\support-samples\CustomSample\Bold_Adhoc_Embed\deploy\adhoc"
$zip = "d:\GitHub\BDSAdhoc\BoldAdhocEmbed-Linux-Deploy.zip"
Remove-Item $zip -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $src '*') -DestinationPath $zip -Force
```

### 4.3 Verify the zip is flat

```powershell
$zip = "d:\GitHub\BDSAdhoc\BoldAdhocEmbed-Linux-Deploy.zip"
$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace($zip)
$folder.Items() | Select-Object Name | Format-Table -AutoSize
```

Expected: the very first entries include `BoldAdhocEmbed.Server`,
`wwwroot`, `appsettings.json`, `appsettings.Production.json`, etc.
**No** `publish/` wrapper.

---

## 5. Push the zip to Linux

```powershell
pscp -i "D:/gcp-boldbi-presale-vm.ppk" `
     "d:\GitHub\BDSAdhoc\BoldAdhocEmbed-Linux-Deploy.zip" `
     syncfusion@192.168.7.68:/home/syncfusion
```

---

## 6. Replace the running application on Linux

```bash
ssh -i "D:/gcp-boldbi-presale-vm.ppk" syncfusion@192.168.7.68

# 6.1 Stop the existing service
sudo systemctl stop boldadhoc-adhoc

# 6.2 Back up the previous folder (timestamped)
sudo mv /var/www/boldreports/adhoc \
        /var/www/boldreports/adhoc.bak.$(date +%Y%m%d_%H%M%S)

# 6.3 Recreate the target folder
sudo mkdir -p /var/www/boldreports/adhoc
sudo chown syncfusion:syncfusion /var/www/boldreports/adhoc

# 6.4 Unzip the new build in place (replaces the old contents entirely)
cd /var/www/boldreports/adhoc
sudo unzip -o /home/syncfusion/BoldAdhocEmbed-Linux-Deploy.zip

# 6.5 Make the binary executable and restore ownership for the service user
sudo chmod +x /var/www/boldreports/adhoc/BoldAdhocEmbed.Server
sudo chown -R www-data:www-data /var/www/boldreports/adhoc

# 6.6 Start the service
sudo systemctl daemon-reload
sudo systemctl start boldadhoc-adhoc
sudo systemctl status boldadhoc-adhoc

# 6.7 (Optional) Tail the logs
journalctl -u boldadhoc-adhoc -f --no-pager
```

Expected successful log:

```text
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5992
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to shut down.
```

---

## 7. Verify end-to-end

```bash
# Local
curl -I http://127.0.0.1:5992/

# Public hostname (your existing Nginx vhost)
curl -I https://rls.boldreportsdemo.com
```

---

## 8. Rollback (if the new build misbehaves)

```bash
sudo systemctl stop boldadhoc-adhoc
sudo rm -rf /var/www/boldreports/adhoc
sudo mv /var/www/boldreports/adhoc.bak.<timestamp> /var/www/boldreports/adhoc
sudo chown -R www-data:www-data /var/www/boldreports/adhoc
sudo systemctl start boldadhoc-adhoc
```

---

## 9. Reference: target environment

### systemd unit — `/etc/systemd/system/boldadhoc-adhoc.service`

```ini
[Unit]
Description=Bold Adhoc Application Service
After=network.target

[Service]
WorkingDirectory=/var/www/boldreports/adhoc
ExecStart=/var/www/boldreports/adhoc/BoldAdhocEmbed.Server
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=boldadhoc-adhoc
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false
Environment=ASPNETCORE_URLS=http://localhost:5992

[Install]
WantedBy=multi-user.target
```

### Nginx vhost — `/etc/nginx/sites-available/rls.boldreportsdemo.com`

```nginx
server {
    listen 80;
    server_name rls.boldreportsdemo.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rls.boldreportsdemo.com;

    ssl_certificate     /etc/letsencrypt/live/showcase.boldreportsdemo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/showcase.boldreportsdemo.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:5992/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
```

### Expected folder layout after deploy

```text
/var/www/boldreports/adhoc/
├── BoldAdhocEmbed.Server
├── BoldAdhocEmbed.Server.pdb
├── BoldAdhocEmbed.Server.staticwebassets.endpoints.json
├── appsettings.json
├── appsettings.Development.json
├── appsettings.Production.json
├── embedConfig.json
├── nuget.config
├── package.json
├── package-lock.json
├── Docs/
└── wwwroot/
```

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `status=203/EXEC` in `journalctl` | Zip had a nested `publish/` folder; systemd can't find the binary at the configured path | Re-zip with a flat layout (see §4) or move files up one level: `cd /var/www/boldreports/adhoc/publish && sudo mv -- * .[!.]* ..` |
| `unzip: command not found` | `unzip` not installed | `sudo apt-get install -y unzip` |
| `Permission denied` when starting | Binary not executable, or wrong owner | `sudo chmod +x /var/www/boldreports/adhoc/BoldAdhocEmbed.Server` and `sudo chown -R www-data:www-data /var/www/boldreports/adhoc` |
| `Failed to bind to address … 5992 already in use` | Old process still running | `sudo pkill -f BoldAdhocEmbed.Server; sleep 2; sudo systemctl start boldadhoc-adhoc` |
| Site loads but `appsettings.Production.json` not picked up | Wrong `ASPNETCORE_ENVIRONMENT` or file not overwritten | Confirm unit's `Environment=ASPNETCORE_ENVIRONMENT=Production`; verify with `sudo systemctl show boldadhoc-adhoc \| grep Environment` |
| `BoldAdhocEmbed.Server: cannot execute: required file not found` | GLIBC mismatch on the host (publish was built on a newer distro) | Rebuild on a host with the **same or older** glibc, or use an `alpine` base in the Dockerfile (musl) |

---

## 11. End-to-end cheat sheet

### Windows (PowerShell)

```powershell
# 1. Build
git pull
cd "d:\GitHub\New folder\support-samples\CustomSample\Bold_Adhoc_Embed"
# Either run the script in Git Bash, or do the steps manually:
#   - npm install && npm run build in boldadhocembed.client/
#   - dotnet publish ... -r linux-x64 --self-contained true

# 2. Flat zip
$src  = ".\publish"
$stg  = ".\deploy\adhoc"
$zip  = "d:\GitHub\BDSAdhoc\BoldAdhocEmbed-Linux-Deploy.zip"
Remove-Item -Recurse -Force ".\deploy" -ErrorAction SilentlyContinue
Remove-Item $zip -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stg | Out-Null
Copy-Item -Recurse -Force (Join-Path $src '*') $stg
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stg, $zip)

# 3. Push
pscp -i "D:/gcp-boldbi-presale-vm.ppk" $zip syncfusion@192.168.7.68:/home/syncfusion
```

### Linux (Bash)

```bash
sudo systemctl stop boldadhoc-adhoc
sudo mv /var/www/boldreports/adhoc /var/www/boldreports/adhoc.bak.$(date +%Y%m%d_%H%M%S)
sudo mkdir -p /var/www/boldreports/adhoc
cd /var/www/boldreports/adhoc && sudo unzip -o /home/syncfusion/BoldAdhocEmbed-Linux-Deploy.zip
sudo chmod +x BoldAdhocEmbed.Server
sudo chown -R www-data:www-data /var/www/boldreports/adhoc
sudo systemctl start boldadhoc-adhoc
sudo systemctl status boldadhoc-adhoc
```

## 📦 Package Contents
- `publish/` - Compiled .NET application with embedded React frontend
- `boldadhoc-adhoc.service` - Systemd service configuration file
- `.env.production` - Production environment configuration

## 🚀 Deployment Steps on Linux Server

### 1. Prerequisites
Ensure the following are installed on your Linux server:
```bash
# Install .NET Runtime dependencies
sudo apt-get update
sudo apt-get install -y libgdiplus libx11-dev libc6-dev

# (Optional) Install monitoring tools
sudo apt-get install -y htop curl
```

### 2. Extract the ZIP Package
```bash
# Create deployment directory
sudo mkdir -p /var/www/boldadhoc

# Extract package
cd /tmp
unzip BoldAdhocEmbed-Linux-Deploy.zip

# Copy publish folder to deployment directory
sudo cp -r publish/* /var/www/boldadhoc/
sudo cp boldadhoc-adhoc.service /tmp/

# Set permissions
sudo chown -r www-data:www-data /var/www/boldadhoc
sudo chmod -R 755 /var/www/boldadhoc
```

### 3. Set Up Systemd Service
```bash
# Copy service file
sudo cp boldadhoc-adhoc.service /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable boldadhoc-adhoc.service

# Start the service
sudo systemctl start boldadhoc-adhoc.service

# Check service status
sudo systemctl status boldadhoc-adhoc.service
```

### 4. Configure Nginx
Add this location block to your Nginx configuration (typically `/etc/nginx/sites-available/default` or your site config):

```nginx
server {
    listen 443 ssl http2;
    server_name rls.boldreportsdemo.com;

    ssl_certificate /etc/letsencrypt/live/showcase.boldreportsdemo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/showcase.boldreportsdemo.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5991;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. Verify Nginx Configuration and Restart
```bash
# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 6. Verify the Application
```bash
# Check service is running
sudo systemctl status boldadhoc-adhoc.service

# View real-time logs
sudo journalctl -u boldadhoc-adhoc.service -f

# Test local connection
curl http://localhost:5991

# Verify on port 5991 is listening
sudo netstat -tlnp | grep 5991
# or
sudo ss -tlnp | grep 5991
```

### 7. Access the Application
Open your browser and navigate to:
```
https://rls.boldreportsdemo.com
```

## 📋 Configuration Details

### Service File Information
- **Service Name:** boldadhoc-adhoc.service
- **Working Directory:** /var/www/boldadhoc/publish
- **Executable:** BoldAdhocEmbed.Server.dll
- **Internal Port:** 5991 (localhost only, not exposed externally)
- **User:** www-data

### Environment Configuration
The application uses `.env.production` with:
- **API Base URL:** https://rls.boldreportsdemo.com/api
- **Bold Reports URL:** https://demos.boldreports.com/services/api/ReportViewer
- **Bold BI API:** https://cloud.boldreports.com/reporting/api/site/site1/v5.0

## 🔧 Troubleshooting

### Service Won't Start
```bash
# Check service logs
sudo journalctl -u boldadhoc-adhoc.service -n 50

# Check permissions
sudo ls -la /var/www/boldadhoc/
```

### Application Running but Nginx Returns 502 Bad Gateway
```bash
# Verify the application is listening on port 5991
sudo ss -tlnp | grep 5991

# Restart the service
sudo systemctl restart boldadhoc-adhoc.service

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### High CPU or Memory Usage
```bash
# Monitor resource usage
htop

# Check application processes
ps aux | grep BoldAdhocEmbed
```

## 📊 Monitoring Commands

```bash
# View service logs (last 100 lines)
sudo journalctl -u boldadhoc-adhoc.service -n 100

# Follow logs in real-time
sudo journalctl -u boldadhoc-adhoc.service -f

# Check service status
sudo systemctl status boldadhoc-adhoc.service

# Check if application is listening
sudo netstat -tlnp | grep 5991
```

## 🔄 Updating the Application

To update the application in the future:

1. Build a new version on Windows using the same process
2. Create a new deployment package
3. Stop the service: `sudo systemctl stop boldadhoc-adhoc.service`
4. Backup current version: `sudo cp -r /var/www/boldadhoc /var/www/boldadhoc.backup`
5. Extract new package: `sudo cp -r publish/* /var/www/boldadhoc/`
6. Start service: `sudo systemctl start boldadhoc-adhoc.service`

## 📝 Important Notes

- The React frontend is embedded within the .NET application and served automatically
- The application connects to external Bold Reports and Bold BI services
- Ensure firewall allows HTTPS (port 443) traffic
- The internal port 5991 is only accessible locally; all external access goes through Nginx
- The `www-data` user must have read permissions on all application files

## 🆘 Support

For issues related to:
- **Bold Reports:** Check Bold Reports cloud console
- **Bold BI:** Check Bold BI server settings
- **Application errors:** Review `/var/www/boldadhoc/logs/` (if logging is configured)

---
**Deployment Package Version:** 1.0  
**Created:** 2026-06-11  
**Application:** Bold Adhoc Embed  
**Target Domain:** rls.boldreportsdemo.com
