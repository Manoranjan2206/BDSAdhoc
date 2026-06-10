#!/bin/bash

# ============================================
# BoldAdhocEmbed - No Docker Setup Script
# ============================================

echo ""
echo "========================================"
echo " BoldAdhocEmbed Setup (No Docker)"
echo "========================================"
echo ""

# Check for .NET SDK
echo "Checking for .NET SDK..."
if ! command -v dotnet &> /dev/null; then
    echo "ERROR: .NET SDK not found!"
    echo "Please install .NET 10 SDK from: https://dotnet.microsoft.com/download/dotnet/10.0"
    exit 1
fi
echo "? .NET SDK found: $(dotnet --version)"

# Check for Node.js
echo "Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found!"
    echo "Please install Node.js from: https://nodejs.org/"
    exit 1
fi
echo "? Node.js found: $(node --version)"

# Check for npm
echo "Checking for npm..."
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm not found!"
    echo "npm should be installed with Node.js"
    exit 1
fi
echo "? npm found: $(npm --version)"

# Install frontend dependencies
echo ""
echo "Installing frontend dependencies..."
cd boldadhocembed.client
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install npm packages"
    exit 1
fi
echo "? Frontend dependencies installed"
cd ..

# Trust HTTPS certificate (macOS/Linux)
echo ""
echo "Setting up HTTPS certificate..."
dotnet dev-certs https --trust 2>/dev/null
echo "? HTTPS certificate ready"

echo ""
echo "========================================"
echo " Setup Complete!"
echo "========================================"
echo ""
echo "To start the application:"
echo ""
echo "Terminal 1 - Backend:"
echo "  cd BoldAdhocEmbed.Server"
echo "  dotnet run"
echo ""
echo "Terminal 2 - Frontend:"
echo "  cd boldadhocembed.client"
echo "  npm run dev"
echo ""
echo "Then open: http://localhost:5173"
echo ""
echo "========================================"
echo ""
