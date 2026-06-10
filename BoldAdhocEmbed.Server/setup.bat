@echo off
REM ============================================
REM BoldAdhocEmbed - No Docker Setup Script
REM ============================================

echo.
echo ========================================
echo  BoldAdhocEmbed Setup (No Docker)
echo ========================================
echo.

REM Check for .NET SDK
echo Checking for .NET SDK...
dotnet --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: .NET SDK not found!
    echo Please install .NET 10 SDK from: https://dotnet.microsoft.com/download/dotnet/10.0
    pause
    exit /b 1
)
echo ? .NET SDK found

REM Check for Node.js
echo Checking for Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found!
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)
echo ? Node.js found

REM Check for npm
echo Checking for npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm not found!
    echo npm should be installed with Node.js
    pause
    exit /b 1
)
echo ? npm found

REM Install frontend dependencies
echo.
echo Installing frontend dependencies...
cd boldadhocembed.client
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install npm packages
    pause
    exit /b 1
)
echo ? Frontend dependencies installed
cd ..

REM Trust HTTPS certificate
echo.
echo Setting up HTTPS certificate...
dotnet dev-certs https --trust >nul 2>&1
echo ? HTTPS certificate ready

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo To start the application:
echo.
echo Terminal 1 - Backend:
echo   cd BoldAdhocEmbed.Server
echo   dotnet run
echo.
echo Terminal 2 - Frontend:
echo   cd boldadhocembed.client
echo   npm run dev
echo.
echo Then open: http://localhost:5173
echo.
echo ========================================
echo.
pause
