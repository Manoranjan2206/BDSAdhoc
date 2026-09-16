param(
    [string]$OutputFile = "bdsadhoc-docker-deploy.zip"
)

$destPath = Join-Path $PSScriptRoot "..\$OutputFile"
$destPath = [System.IO.Path]::GetFullPath($destPath)

if (Test-Path $destPath) {
    Remove-Item $destPath -Force
}

$rootPath = (Get-Item (Join-Path $PSScriptRoot "..")).FullName

$stageDir = Join-Path $env:TEMP ("bdsadhoc_docker_stage_" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $stageDir | Out-Null

try {
    Write-Host "Staging pre-built docker deployment files..."

    $rootFiles = @(
        'bdsadhoc-app.tar',
        'docker-compose.yml',
        'docker-compose.prod.yml',
        '.env',
        '.env.example',
        '.dockerignore',
        'deploy.sh',
        'LINUX-PRODUCTION-DEPLOYMENT.md',
        'LINUX-DEPLOYMENT.md'
    )

    foreach ($file in $rootFiles) {
        $sourceFile = Join-Path $rootPath $file
        if (Test-Path $sourceFile) {
            Write-Host "Adding $file..."
            Copy-Item -Path $sourceFile -Destination (Join-Path $stageDir $file)
        }
    }

    # Copy nginx directory
    Copy-Item -Path (Join-Path $rootPath 'nginx') -Destination (Join-Path $stageDir 'nginx') -Recurse

    # Copy sql directory
    Copy-Item -Path (Join-Path $rootPath 'sql') -Destination (Join-Path $stageDir 'sql') -Recurse

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    Write-Host "Compressing to zip archive: $destPath"
    [System.IO.Compression.ZipFile]::CreateFromDirectory($stageDir, $destPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)

    $fileInfo = Get-Item $destPath
    $sizeMb = [math]::Round($fileInfo.Length / 1MB, 2)
    Write-Host "Successfully generated $destPath ($sizeMb MB)"
}
finally {
    if (Test-Path $stageDir) {
        Remove-Item -Path $stageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
