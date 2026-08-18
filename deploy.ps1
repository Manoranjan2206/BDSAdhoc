# Bold Adhoc Deployment Script
# Usage: ./deploy.ps1 -KeyPath "path/to/key.ppk" -RemoteUser "syncfusion" -RemoteHost "boldbi-presale-vm"

param(
    [string]$KeyPath = "D:\SSH\boldbi-presale-vm.ppk",
    [string]$RemoteUser = "syncfusion",
    [string]$RemoteHost = "boldbi-presale-vm",
    [string]$RemotePath = "/home/$RemoteUser",
    [string]$ZipFile = "D:\GitHub\BDSAdhoc\BoldAdhocEmbed-Linux-Deploy.zip"
)

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Bold Adhoc Linux Deployment" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Verify files exist
Write-Host "📋 Checking files..." -ForegroundColor Yellow

if (-not (Test-Path $ZipFile)) {
    Write-Host "❌ ZIP file not found: $ZipFile" -ForegroundColor Red
    exit 1
}
Write-Host "✓ ZIP file found: $(Split-Path $ZipFile -Leaf)" -ForegroundColor Green

if (-not (Test-Path $KeyPath)) {
    Write-Host "⚠️  Private key not found. You may need to provide it interactively." -ForegroundColor Yellow
}
else {
    Write-Host "✓ Private key found: $(Split-Path $KeyPath -Leaf)" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Deployment Details:" -ForegroundColor Cyan
Write-Host "   Source ZIP: $(Split-Path $ZipFile -Leaf)"
Write-Host "   Remote Host: $RemoteUser@$RemoteHost"
Write-Host "   Remote Path: $RemotePath"
Write-Host ""

# Check if pscp exists
$pscp = Get-Command pscp -ErrorAction SilentlyContinue
if ($null -eq $pscp) {
    Write-Host "ℹ️  pscp not found in PATH. You may need to install PuTTY tools or use ssh instead." -ForegroundColor Yellow
    Write-Host "   Trying with 'ssh' command instead..." -ForegroundColor Yellow
    Write-Host ""
    
    # Use scp instead
    Write-Host "Running SCP command..." -ForegroundColor Cyan
    $command = "scp $(if ($KeyPath) {"-i `"$KeyPath`""}) `"$ZipFile`" $RemoteUser@$RemoteHost`:$RemotePath/"
    Write-Host "Command: $command" -ForegroundColor Gray
    Write-Host ""
    
    Invoke-Expression $command
}
else {
    # Use pscp
    Write-Host "Running PSCP command..." -ForegroundColor Cyan
    $command = "pscp $(if ($KeyPath) {"-i `"$KeyPath`""}) `"$ZipFile`" $RemoteUser@$RemoteHost`:$RemotePath/"
    Write-Host "Command: $command" -ForegroundColor Gray
    Write-Host ""
    
    & pscp $(if ($KeyPath) {"-i"}) $(if ($KeyPath) {$KeyPath}) "$ZipFile" "$RemoteUser@$RemoteHost`:$RemotePath/"
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ File transferred successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps on the Linux server:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   1. SSH into the server:"
    Write-Host "      ssh $RemoteUser@$RemoteHost"
    Write-Host ""
    Write-Host "   2. Extract and deploy:"
    Write-Host "      cd $RemotePath"
    Write-Host "      unzip BoldAdhocEmbed-Linux-Deploy.zip"
    Write-Host "      cd /var/www/boldreports"
    Write-Host "      sudo mkdir -p adhoc"
    Write-Host "      sudo cp -r ~/publish/* ./adhoc/"
    Write-Host "      sudo chown -R www-data:www-data ./adhoc"
    Write-Host ""
    Write-Host "   3. Setup service:"
    Write-Host "      sudo cp ~/boldadhoc-adhoc.service /etc/systemd/system/"
    Write-Host "      sudo systemctl daemon-reload"
    Write-Host "      sudo systemctl enable boldadhoc-adhoc.service"
    Write-Host "      sudo systemctl start boldadhoc-adhoc.service"
    Write-Host ""
    Write-Host "   4. Check status:"
    Write-Host "      sudo systemctl status boldadhoc-adhoc.service"
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "❌ File transfer failed!" -ForegroundColor Red
    Write-Host "Exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}
