#Requires -Version 5.0

<#
.SYNOPSIS
    Bulk creates users in Bold Reports Server for all 4 industries (20 users total)

.DESCRIPTION
    This script adds all CRM users from AlphaCorp, Beta Solutions, Delta Enterprises, 
    and Gamma Industries to Bold Reports Server via REST API.

.PARAMETER Endpoint
    The Bold Reports API endpoint (default: https://adhoc.boldreports.com/reporting/api/site/site11/v1.0/users)

.PARAMETER Token
    Bearer token for API authentication

.PARAMETER Password
    Default password for all users (default: Admin@123)

.EXAMPLE
    .\Add-BoldReportsUsers.ps1 -Token "bearer eyJhbGc..."

.NOTES
    Author: BoldAdhocEmbed Team
    Date: 2026-09-08
    Requires: PowerShell 5.0+
#>

param(
    [string]$Endpoint = "https://adhoc.boldreports.com/reporting/api/site/site11/v1.0/users",
    [Parameter(Mandatory=$true)]
    [string]$Token,
    [string]$Password = "Admin@123",
    [int]$DelayMs = 500,
    [switch]$WhatIf
)

# ============================================================================
# CONFIGURATION
# ============================================================================

$ProgressPreference = 'Continue'
$ErrorActionPreference = 'Continue'

# Define colors for output
$Colors = @{
    Success = 'Green'
    Error   = 'Red'
    Warning = 'Yellow'
    Info    = 'Cyan'
    Header  = 'Magenta'
}

# ============================================================================
# USER DATA - ALL 4 INDUSTRIES (20 USERS TOTAL)
# ============================================================================

$Users = @(
    # ========== AlphaCorp (5 users) ==========
    @{
        Industry  = "AlphaCorp"
        Email     = "alpha1@alphacorp.com"
        UserName  = "anna.smith"
        FirstName = "Anna"
        LastName  = "Smith"
        Role      = "Admin"
    },
    @{
        Industry  = "AlphaCorp"
        Email     = "alpha2@alphacorp.com"
        UserName  = "john.doe"
        FirstName = "John"
        LastName  = "Doe"
        Role      = "Sales"
    },
    @{
        Industry  = "AlphaCorp"
        Email     = "alpha3@alphacorp.com"
        UserName  = "linda.lee"
        FirstName = "Linda"
        LastName  = "Lee"
        Role      = "Finance"
    },
    @{
        Industry  = "AlphaCorp"
        Email     = "alpha4@alphacorp.com"
        UserName  = "mike.brown"
        FirstName = "Mike"
        LastName  = "Brown"
        Role      = "Support"
    },
    @{
        Industry  = "AlphaCorp"
        Email     = "alpha5@alphacorp.com"
        UserName  = "chris.green"
        FirstName = "Chris"
        LastName  = "Green"
        Role      = "Operations"
    },

    # ========== Beta Solutions (5 users) ==========
    @{
        Industry  = "Beta Solutions"
        Email     = "beta1@betasolutions.com"
        UserName  = "betty.jones"
        FirstName = "Betty"
        LastName  = "Jones"
        Role      = "Admin"
    },
    @{
        Industry  = "Beta Solutions"
        Email     = "beta2@betasolutions.com"
        UserName  = "julia.king"
        FirstName = "Julia"
        LastName  = "King"
        Role      = "Sales"
    },
    @{
        Industry  = "Beta Solutions"
        Email     = "beta3@betasolutions.com"
        UserName  = "brian.adams"
        FirstName = "Brian"
        LastName  = "Adams"
        Role      = "Finance"
    },
    @{
        Industry  = "Beta Solutions"
        Email     = "beta4@betasolutions.com"
        UserName  = "diana.miller"
        FirstName = "Diana"
        LastName  = "Miller"
        Role      = "Support"
    },
    @{
        Industry  = "Beta Solutions"
        Email     = "beta5@betasolutions.com"
        UserName  = "eliza.scott"
        FirstName = "Eliza"
        LastName  = "Scott"
        Role      = "Operations"
    },

    # ========== Delta Enterprises (5 users) ==========
    @{
        Industry  = "Delta Enterprises"
        Email     = "delta1@deltaenterprises.com"
        UserName  = "megan.young"
        FirstName = "Megan"
        LastName  = "Young"
        Role      = "Admin"
    },
    @{
        Industry  = "Delta Enterprises"
        Email     = "delta2@deltaenterprises.com"
        UserName  = "zoe.turner"
        FirstName = "Zoe"
        LastName  = "Turner"
        Role      = "Sales"
    },
    @{
        Industry  = "Delta Enterprises"
        Email     = "delta3@deltaenterprises.com"
        UserName  = "ryan.evans"
        FirstName = "Ryan"
        LastName  = "Evans"
        Role      = "Finance"
    },
    @{
        Industry  = "Delta Enterprises"
        Email     = "delta4@deltaenterprises.com"
        UserName  = "liam.cooper"
        FirstName = "Liam"
        LastName  = "Cooper"
        Role      = "Support"
    },
    @{
        Industry  = "Delta Enterprises"
        Email     = "delta5@deltaenterprises.com"
        UserName  = "emma.hall"
        FirstName = "Emma"
        LastName  = "Hall"
        Role      = "Operations"
    },

    # ========== Gamma Industries (5 users) ==========
    @{
        Industry  = "Gamma Industries"
        Email     = "gamma1@gammaindustries.com"
        UserName  = "george.william"
        FirstName = "George"
        LastName  = "William"
        Role      = "Admin"
    },
    @{
        Industry  = "Gamma Industries"
        Email     = "gamma2@gammaindustries.com"
        UserName  = "jack.black"
        FirstName = "Jack"
        LastName  = "Black"
        Role      = "Sales"
    },
    @{
        Industry  = "Gamma Industries"
        Email     = "gamma3@gammaindustries.com"
        UserName  = "olivia.martin"
        FirstName = "Olivia"
        LastName  = "Martin"
        Role      = "Finance"
    },
    @{
        Industry  = "Gamma Industries"
        Email     = "gamma4@gammaindustries.com"
        UserName  = "sophia.white"
        FirstName = "Sophia"
        LastName  = "White"
        Role      = "Support"
    },
    @{
        Industry  = "Gamma Industries"
        Email     = "gamma5@gammaindustries.com"
        UserName  = "noah.clark"
        FirstName = "Noah"
        LastName  = "Clark"
        Role      = "Operations"
    }
)

# ============================================================================
# FUNCTIONS
# ============================================================================

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = 'White'
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-ColorOutput ("=" * 80) $Colors.Header
    Write-ColorOutput "  $Text" $Colors.Header
    Write-ColorOutput ("=" * 80) $Colors.Header
    Write-Host ""
}

function Write-Section {
    param([string]$Text)
    Write-Host ""
    Write-ColorOutput "[*] $Text" $Colors.Info
    Write-ColorOutput ("-" * 60) $Colors.Info
}

function Test-ApiConnection {
    param(
        [string]$Endpoint,
        [string]$Token
    )
    
    Write-Section "Testing API Connection"
    
    try {
        $headers = @{
            "Authorization" = $Token
            "Content-Type"  = "application/json"
        }
        
        # Test with a simple GET request (adjust endpoint as needed)
        $testResponse = Invoke-RestMethod `
            -Uri "$Endpoint" `
            -Method GET `
            -Headers $headers `
            -TimeoutSec 10
        
        Write-ColorOutput "[OK] API connection successful" $Colors.Success
        return $true
    }
    catch {
        Write-ColorOutput "[FAILED] API connection failed: $($_.Exception.Message)" $Colors.Error
        return $false
    }
}

function Add-UserToBold {
    param(
        [string]$Endpoint,
        [string]$Token,
        [hashtable]$User,
        [string]$Password,
        [int]$Index,
        [int]$Total
    )
    
    try {
        $headers = @{
            "Authorization" = $Token
            "Content-Type"  = "application/json"
        }
        
        $body = @{
            Email     = $User.Email
            UserName  = $User.UserName
            FirstName = $User.FirstName
            LastName  = $User.LastName
            Password  = $Password
        } | ConvertTo-Json
        
        if ($WhatIf) {
            Write-ColorOutput "  [WhatIf] Would create: $($User.Email) ($($User.UserName))" $Colors.Warning
            return $true
        }
        
        $response = Invoke-RestMethod `
            -Uri $Endpoint `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -TimeoutSec 30
        
        Write-ColorOutput "  [$Index/$Total] [OK] $($User.Email) - $($User.FirstName) $($User.LastName)" $Colors.Success
        return $true
    }
    catch {
        Write-ColorOutput "  [$Index/$Total] [FAILED] $($User.Email) - Error: $($_.Exception.Message)" $Colors.Error
        return $false
    }
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

Write-Header "Bold Reports User Creation Script"

# Display configuration
Write-Section "Configuration"
Write-ColorOutput "Endpoint: $Endpoint" $Colors.Info
Write-ColorOutput "Site: site11" $Colors.Info
Write-ColorOutput "Default Password: ••••••••" $Colors.Info
Write-ColorOutput "Total Users to Create: $($Users.Count)" $Colors.Info
Write-ColorOutput "Delay Between Requests: ${DelayMs}ms" $Colors.Info

if ($WhatIf) {
    Write-ColorOutput "Mode: WhatIf (No changes will be made)" $Colors.Warning
}

# Test API connection
if (-not (Test-ApiConnection -Endpoint $Endpoint -Token $Token)) {
    Write-ColorOutput "Script terminated: Cannot connect to API" $Colors.Error
    exit 1
}

# Group users by industry and create them
Write-Header "Creating Users"

$successCount = 0
$failureCount = 0
$totalCount = $Users.Count

# Group by industry for display
$usersByIndustry = $Users | Group-Object -Property Industry

foreach ($industryGroup in $usersByIndustry) {
    Write-Section "Industry: $($industryGroup.Name) ($($industryGroup.Count) users)"
    
    $industryIndex = 0
    foreach ($user in $industryGroup.Group) {
        $industryIndex++
        $overallIndex = ($Users.IndexOf($user) + 1)
        
        $success = Add-UserToBold `
            -Endpoint $Endpoint `
            -Token $Token `
            -User $user `
            -Password $Password `
            -Index $overallIndex `
            -Total $totalCount
        
        if ($success) {
            $successCount++
        }
        else {
            $failureCount++
        }
        
        # Rate limiting - delay between requests
        if ($industryIndex -lt $industryGroup.Count) {
            Start-Sleep -Milliseconds $DelayMs
        }
    }
}

# Summary Report
Write-Header "Execution Summary"

$summaryTable = @(
    [PSCustomObject]@{ Metric = "Total Users"; Value = $totalCount }
    [PSCustomObject]@{ Metric = "Successfully Created"; Value = $successCount }
    [PSCustomObject]@{ Metric = "Failed"; Value = $failureCount }
    [PSCustomObject]@{ Metric = "Success Rate"; Value = if ($totalCount -gt 0) { "{0:P2}" -f ($successCount / $totalCount) } else { "N/A" } }
)

$summaryTable | Format-Table -Property Metric, Value -AutoSize

# Industry breakdown
Write-Section "Users by Industry"

$industryTable = @(
    [PSCustomObject]@{ Industry = "AlphaCorp"; Count = 5; Users = "anna.smith, john.doe, linda.lee, mike.brown, chris.green" }
    [PSCustomObject]@{ Industry = "Beta Solutions"; Count = 5; Users = "betty.jones, julia.king, brian.adams, diana.miller, eliza.scott" }
    [PSCustomObject]@{ Industry = "Delta Enterprises"; Count = 5; Users = "megan.young, zoe.turner, ryan.evans, liam.cooper, emma.hall" }
    [PSCustomObject]@{ Industry = "Gamma Industries"; Count = 5; Users = "george.william, jack.black, olivia.martin, sophia.white, noah.clark" }
)

$industryTable | Format-Table -Property Industry, Count -AutoSize

# Final status
Write-Host ""
if ($failureCount -eq 0) {
    Write-ColorOutput "[SUCCESS] All users created successfully!" $Colors.Success
    exit 0
}
elseif ($successCount -gt 0) {
    Write-ColorOutput "[WARNING] Partial success: $successCount created, $failureCount failed" $Colors.Warning
    exit 1
}
else {
    Write-ColorOutput "[ERROR] All user creations failed" $Colors.Error
    exit 2
}
