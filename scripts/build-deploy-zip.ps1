param(
    [string]$OutputFile = "bdsadhoc-prod-deploy.zip"
)

$destPath = Join-Path $PSScriptRoot "..\$OutputFile"
$destPath = [System.IO.Path]::GetFullPath($destPath)

if (Test-Path $destPath) {
    Remove-Item $destPath -Force
}

$rootPath = (Get-Item (Join-Path $PSScriptRoot "..")).FullName

$stageDir = Join-Path $env:TEMP ("bdsadhoc_stage_" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $stageDir | Out-Null

try {
    Write-Host "Staging deployment files..."

    $rootFiles = @(
        'BoldAdhocEmbed.slnx',
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
            Copy-Item -Path $sourceFile -Destination (Join-Path $stageDir $file)
        }
    }

    # Copy nginx directory
    Copy-Item -Path (Join-Path $rootPath 'nginx') -Destination (Join-Path $stageDir 'nginx') -Recurse

    # Copy sql directory
    Copy-Item -Path (Join-Path $rootPath 'sql') -Destination (Join-Path $stageDir 'sql') -Recurse

    # Copy BoldAdhocEmbed.Server excluding bin, obj, *.user, server.log
    $serverDir = Join-Path $rootPath 'BoldAdhocEmbed.Server'
    $serverStage = Join-Path $stageDir 'BoldAdhocEmbed.Server'
    New-Item -ItemType Directory -Path $serverStage | Out-Null

    Get-ChildItem -Path $serverDir -Recurse | ForEach-Object {
        $relPath = $_.FullName.Substring($serverDir.Length + 1)
        if ($relPath -notmatch '^(bin|obj)(\\|\/|$)' -and $_.Extension -ne '.user' -and $_.Name -ne 'server.log') {
            $target = Join-Path $serverStage $relPath
            if ($_.PSIsContainer) {
                if (-not (Test-Path $target)) { New-Item -ItemType Directory -Path $target | Out-Null }
            } else {
                $targetParent = Split-Path $target -Parent
                if (-not (Test-Path $targetParent)) { New-Item -ItemType Directory -Path $targetParent | Out-Null }
                Copy-Item -Path $_.FullName -Destination $target
            }
        }
    }

    # Copy boldadhocembed.client excluding node_modules, dist, obj, lint.txt
    $clientDir = Join-Path $rootPath 'boldadhocembed.client'
    $clientStage = Join-Path $stageDir 'boldadhocembed.client'
    New-Item -ItemType Directory -Path $clientStage | Out-Null

    Get-ChildItem -Path $clientDir -Recurse | ForEach-Object {
        $relPath = $_.FullName.Substring($clientDir.Length + 1)
        if ($relPath -notmatch '^(node_modules|dist|obj)(\\|\/|$)' -and $_.Name -ne 'lint.txt') {
            $target = Join-Path $clientStage $relPath
            if ($_.PSIsContainer) {
                if (-not (Test-Path $target)) { New-Item -ItemType Directory -Path $target | Out-Null }
            } else {
                $targetParent = Split-Path $target -Parent
                if (-not (Test-Path $targetParent)) { New-Item -ItemType Directory -Path $targetParent | Out-Null }
                Copy-Item -Path $_.FullName -Destination $target
            }
        }
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    Write-Host "Creating zip archive: $destPath"
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
