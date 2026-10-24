#!/bin/bash

# ============================================
# BoldAdhocEmbed - Linux Publish & Deploy Script
# ============================================
# Replaces/overwrites any previous publish/ output AND the deploy zip.
# Verified: 2026-07-13  (.NET SDK 10.0.301, Node v20.20.2, npm 11.7.0)
#
# Purpose
# -------
# Single, repeatable script that bundles the client (Vite/React) and the
# BoldAdhocEmbed.Server (.NET 10) into a self-contained Linux-x64 build,
# writes every artifact into ./publish/, and (optionally) produces a flat
# deploy zip whose root matches the Linux folder layout exactly.
#
# Why this setup is required for Linux deployment
# -----------------------------------------------
#   * Windows binaries (.exe / .dll) cannot run on Linux. We therefore must
#     publish with -r linux-x64 so the runtime and the host binary match.
#   * Most production Linux boxes do not have the .NET runtime preinstalled,
#     so we use --self-contained true to ship the runtime inside the app.
#   * PublishSingleFile=true produces one executable that boots the app
#     without a separate dll launcher.
#   * PublishReadyToRun=true pre-JITs the assemblies for faster startup.
#   * The Vite/React client must be built first because .NET publish reads
#     the dist output and copies it into wwwroot/ at publish time.
#   * The deploy zip MUST be flat (no nested publish/ folder); otherwise the
#     Linux target ends up with /var/www/.../adhoc/publish/BoldAdhocEmbed.Server
#     and the systemd unit fails with status=203/EXEC.
#
# Steps performed
# ---------------
#   1. Pre-flight      : verify dotnet, node, npm are available
#   2. Clean           : delete the old ./publish/ folder
#   3. Build client    : cd boldadhocembed.client && npm install && npm run build
#   4. Publish server  : dotnet publish ... -r linux-x64 --self-contained true
#                        /p:PublishSingleFile=true /p:PublishReadyToRun=true
#   5. Stage zip       : mirror ./publish/* into ./deploy/adhoc/ (no nesting)
#   6. Zip             : Compress-Archive -Path deploy/adhoc/* -DestinationPath
#                        ../BDSAdhoc/BoldAdhocEmbed-Linux-Deploy.zip -Force
#                        (creates the zip beside the source repo, overwriting
#                        the previous one)
#
# How to deploy on the Linux host
# -------------------------------
#   1. Push the zip:  pscp -i <ppk> .../BoldAdhocEmbed-Linux-Deploy.zip
#                          syncfusion@<host>:/home/syncfusion
#   2. On the host:  cd /var/www/boldreports/adhoc
#                    sudo systemctl stop boldadhoc-adhoc
#                    sudo rm -rf /var/www/boldreports/adhoc
#                    sudo mkdir -p /var/www/boldreports/adhoc
#                    cd /var/www/boldreports/adhoc && sudo unzip -o ~/BoldAdhocEmbed-Linux-Deploy.zip
#                    sudo chmod +x BoldAdhocEmbed.Server
#                    sudo chown -R www-data:www-data /var/www/boldreports/adhoc
#                    sudo systemctl start boldadhoc-adhoc
#
# Optional: rebuild from scratch on the Linux host
# ------------------------------------------------
#   ./linux-publish.sh
# ============================================

set -e

echo "========================================"
echo " BoldAdhocEmbed - Linux Publish & Deploy"
echo "========================================"

# Step 0: Pre-flight checks
echo ""
echo "--- Step 0: Verifying prerequisites ---"
command -v dotnet >/dev/null 2>&1 || { echo "ERROR: dotnet not found in PATH"; exit 1; }
command -v node    >/dev/null 2>&1 || { echo "ERROR: node not found in PATH"; exit 1; }
command -v npm     >/dev/null 2>&1 || { echo "ERROR: npm not found in PATH"; exit 1; }
echo "dotnet : $(dotnet --version)"
echo "node   : $(node --version)"
echo "npm    : $(npm --version)"

# Step 1: Resolve paths (assumes script lives in the solution root)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/BoldAdhocEmbed.Server"
CLIENT_DIR="$ROOT_DIR/boldadhocembed.client"
PUBLISH_DIR="$ROOT_DIR/publish"
STAGE_DIR="$ROOT_DIR/deploy/adhoc"
ZIP_OUT_DEFAULT="/d/GitHub/BDSAdhoc/BoldAdhocEmbed-Linux-Deploy.zip"
ZIP_OUT="${ZIP_OUT:-$ZIP_OUT_DEFAULT}"

# Step 2: Clean previous publish output so the new build overwrites/replaces it
echo ""
echo "--- Step 1: Cleaning old publish directory (overwrite/replace) ---"
if [ -d "$PUBLISH_DIR" ]; then
    rm -rf "$PUBLISH_DIR"
    echo "Removed existing $PUBLISH_DIR"
fi
mkdir -p "$PUBLISH_DIR"

# Step 3: Build the Vite/React client -> produces dist/ which dotnet copies into wwwroot/
echo ""
echo "--- Step 2: Building Frontend (client) ---"
cd "$CLIENT_DIR"
echo "Running: npm install"
npm install
echo "Running: npm run build"
npm run build
cd "$ROOT_DIR"

# Step 4: Publish the .NET 10 backend as a self-contained Linux-x64 binary
echo ""
echo "--- Step 3: Publishing Backend (.NET 10) for linux-x64 ---"
cd "$SERVER_DIR"
echo "Running: dotnet publish -c Release -r linux-x64 --self-contained true ..."
dotnet publish BoldAdhocEmbed.Server.csproj \
    -c Release \
    -r linux-x64 \
    --self-contained true \
    -o "$PUBLISH_DIR" \
    /p:PublishSingleFile=true \
    /p:PublishReadyToRun=true \
    /p:UseAppHost=true

cd "$ROOT_DIR"

# Step 5: Mark the produced binary executable
echo ""
echo "--- Step 4: Marking binary executable (chmod +x) ---"
if [ -f "$PUBLISH_DIR/BoldAdhocEmbed.Server" ]; then
    chmod +x "$PUBLISH_DIR/BoldAdhocEmbed.Server"
    echo "chmod +x applied to BoldAdhocEmbed.Server"
fi

# Step 6: Build a flat deploy zip (no nested publish/ folder) for the Linux host
echo ""
echo "--- Step 5: Building flat deploy zip ---"
rm -rf "$ROOT_DIR/deploy"
mkdir -p "$STAGE_DIR"
# Mirror publish/* into deploy/adhoc/ so the zip's root = the Linux target folder
cp -r "$PUBLISH_DIR/." "$STAGE_DIR/"

# Create the zip (works on Git Bash / WSL / MSYS where `zip` is available)
if command -v zip >/dev/null 2>&1; then
    mkdir -p "$(dirname "$ZIP_OUT")"
    (cd "$STAGE_DIR" && zip -r -o -q "$ZIP_OUT" .)
    echo "Created flat zip: $ZIP_OUT"
else
    echo "NOTE: 'zip' not found in PATH. To create the zip on Windows, run from PowerShell:"
    echo "  Compress-Archive -Path '$STAGE_DIR\\*' -DestinationPath '$ZIP_OUT' -Force"
fi

echo ""
echo "========================================"
echo " Publish Complete!"
echo " Output    : $PUBLISH_DIR"
echo " Binary    : $PUBLISH_DIR/BoldAdhocEmbed.Server"
echo " Stage dir : $STAGE_DIR"
echo " Zip       : $ZIP_OUT"
echo "========================================"
echo ""
echo "Deploy steps on the Linux host:"
echo "  1. Push the zip:  pscp -i <ppk> $ZIP_OUT syncfusion@<host>:/home/syncfusion"
echo "  2. SSH in, then:"
echo "       sudo systemctl stop boldadhoc-adhoc"
echo "       sudo rm -rf /var/www/boldreports/adhoc"
echo "       sudo mkdir -p /var/www/boldreports/adhoc"
echo "       cd /var/www/boldreports/adhoc && sudo unzip -o ~/BoldAdhocEmbed-Linux-Deploy.zip"
echo "       sudo chmod +x BoldAdhocEmbed.Server"
echo "       sudo chown -R www-data:www-data /var/www/boldreports/adhoc"
echo "       sudo systemctl start boldadhoc-adhoc"
echo ""


