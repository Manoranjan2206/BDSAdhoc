#!/bin/bash

# ============================================
# BoldAdhocEmbed - Linux Publish Script
# ============================================

set -e

echo "========================================"
echo " Starting Linux Build & Publish"
echo "========================================"

# Get the root directory
ROOT_DIR=$(pwd)
SERVER_DIR="$ROOT_DIR/BoldAdhocEmbed.Server"
CLIENT_DIR="$ROOT_DIR/boldadhocembed.client"
PUBLISH_DIR="$ROOT_DIR/publish"

# Clean previous publish folder
if [ -d "$PUBLISH_DIR" ]; then
    echo "Cleaning old publish directory..."
    rm -rf "$PUBLISH_DIR"
fi
mkdir -p "$PUBLISH_DIR"

# Step 1: Install and Build Client
echo ""
echo "--- Step 1: Building Frontend ---"
cd "$CLIENT_DIR"
echo "Installing npm dependencies..."
npm install
echo "Building frontend..."
npm run build
cd "$ROOT_DIR"

# Step 2: Publish Server
echo ""
echo "--- Step 2: Publishing Backend for Linux ---"
cd "$SERVER_DIR"
echo "Restoring and publishing .NET app (Linux-x64)..."
dotnet publish BoldAdhocEmbed.Server.csproj \
    -c Release \
    -r linux-x64 \
    --self-contained true \
    -o "$PUBLISH_DIR" \
    /p:PublishSingleFile=true \
    /p:PublishReadyToRun=true

cd "$ROOT_DIR"

echo ""
echo "========================================"
echo " Publish Complete!"
echo " Location: $PUBLISH_DIR"
echo "========================================"
echo ""
echo "To run the application on Linux:"
echo "  cd publish"
echo "  chmod +x BoldAdhocEmbed.Server"
echo "  ./BoldAdhocEmbed.Server"
echo ""
