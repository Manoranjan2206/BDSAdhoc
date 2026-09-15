# Bold Reports User Creation Script

## Overview
This PowerShell script adds all 20 CRM users from 4 industries (AlphaCorp, Beta Solutions, Delta Enterprises, Gamma Industries) to Bold Reports Server.

**Script Location**: `scripts/Add-BoldReportsUsers.ps1`

---

## Prerequisites

1. **PowerShell 5.0 or higher**
   ```powershell
   $PSVersionTable.PSVersion
   ```

2. **Network Access** to Bold Reports Server API
   - URL: `https://adhoc.boldreports.com/reporting/api/site/site11/v1.0/users`

3. **Valid Bearer Token** (JWT)
   ```
   bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im1hbm9yYW5qYW4ucmFqZW5kcmFuQHN5bmNmdXNpb24uY29tIiwibmFtZWlkIjoiMiIsInVuaXF1ZV9uYW1lIjoiYmFkMTViMDEtMjhmNy00ZWJmLTllYjctNjA3ZGRmNmI1YWFjIiwiSVAiOiIxNzIuMTguMC4zIiwiaXNzdWVkX2RhdGUiOiIxNzg4ODYzODc5IiwibmJmIjoxNzg4ODYzODc5LCJleHAiOjE3ODk1MTY4MDAsImlhdCI6MTc4ODg2Mzg3OSwiaXNzIjoiaHR0cHM6Ly9hZGhvYy5ib2xkcmVwb3J0cy5jb20vcmVwb3J0aW5nL3NpdGUvc2l0ZTExIiwiYXVkIjoiaHR0cHM6Ly9hZGhvYy5ib2xkcmVwb3J0cy5jb20vcmVwb3J0aW5nL3NpdGUvc2l0ZTExIn0.xg0lAqfd2qfBtfI4BEUvXBrYCOjdodLvoNU1XYtpE8w
   ```

---

## Usage

### Basic Execution (With Token)

```powershell
cd d:\GitHub\BDSAdhoc\scripts
.\Add-BoldReportsUsers.ps1 -Token "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### With Custom Endpoint

```powershell
.\Add-BoldReportsUsers.ps1 `
  -Token "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." `
  -Endpoint "https://your-domain.com/reporting/api/site/site11/v1.0/users"
```

### With Custom Password

```powershell
.\Add-BoldReportsUsers.ps1 `
  -Token "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." `
  -Password "CustomPassword@123"
```

### Dry Run (Preview without making changes)

```powershell
.\Add-BoldReportsUsers.ps1 `
  -Token "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." `
  -WhatIf
```

### With Custom Delay Between Requests

```powershell
.\Add-BoldReportsUsers.ps1 `
  -Token "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." `
  -DelayMs 1000
```

---

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `-Token` | string | ✅ Yes | - | Bearer token for API authentication |
| `-Endpoint` | string | ❌ No | `https://adhoc.boldreports.com/reporting/api/site/site11/v1.0/users` | Bold Reports API endpoint |
| `-Password` | string | ❌ No | `Admin@123` | Default password for all users |
| `-DelayMs` | int | ❌ No | `500` | Milliseconds delay between API requests (rate limiting) |
| `-WhatIf` | switch | ❌ No | `false` | Preview changes without making them |

---

## Quick Start Guide

### Step 1: Open PowerShell

Press `Win + X` and select **PowerShell (Admin)** or **Windows Terminal**

### Step 2: Navigate to Script Directory

```powershell
cd d:\GitHub\BDSAdhoc\scripts
```

### Step 3: Set Execution Policy (if needed)

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Step 4: Run the Script

```powershell
.\Add-BoldReportsUsers.ps1 -Token "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Step 5: Review Output

The script will display:
- ✓ Successfully created users (Green)
- ✗ Failed users (Red)
- Summary statistics

---

## Expected Output

```
================================================================================
  Bold Reports User Creation Script
================================================================================

► Configuration
────────────────────────────────────────────────────────────────
Endpoint: https://adhoc.boldreports.com/reporting/api/site/site11/v1.0/users
Site: site11
Default Password: ••••••••
Total Users to Create: 20
Delay Between Requests: 500ms

► Testing API Connection
────────────────────────────────────────────────────────────────
✓ API connection successful

================================================================================
  Creating Users
================================================================================

► Industry: AlphaCorp (5 users)
────────────────────────────────────────────────────────────────
  [1/20] ✓ alpha1@alphacorp.com - Anna Smith
  [2/20] ✓ alpha2@alphacorp.com - John Doe
  [3/20] ✓ alpha3@alphacorp.com - Linda Lee
  [4/20] ✓ alpha4@alphacorp.com - Mike Brown
  [5/20] ✓ alpha5@alphacorp.com - Chris Green

► Industry: Beta Solutions (5 users)
────────────────────────────────────────────────────────────────
  [6/20] ✓ beta1@betasolutions.com - Betty Jones
  ...

================================================================================
  Execution Summary
================================================================================

Metric                     Value
------                     -----
Total Users                   20
Successfully Created          20
Failed                         0
Success Rate               100.00%

► Users by Industry
────────────────────────────────────────────────────────────────

Industry              Count Users
--------              ----- -----
AlphaCorp                 5 anna.smith, john.doe, linda.lee, mike.brown, chris.green
Beta Solutions            5 betty.jones, julia.king, brian.adams, diana.miller, eliza.scott
Delta Enterprises         5 megan.young, zoe.turner, ryan.evans, liam.cooper, emma.hall
Gamma Industries          5 george.william, jack.black, olivia.martin, sophia.white, noah.clark

✓ All users created successfully!
```

---

## Troubleshooting

### Issue: "Script execution is disabled"

**Solution**: Enable script execution
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

### Issue: "Cannot connect to API"

**Verify**:
1. Network connectivity: `Test-NetConnection adhoc.boldreports.com -Port 443`
2. Token is valid and not expired
3. API endpoint is correct

### Issue: "Unauthorized (401)"

**Solution**: Verify token is correct and not expired
```powershell
# Decode JWT token (optional - use online JWT debugger)
# https://jwt.io
```

### Issue: "User already exists"

**Expected behavior**: API may return error for duplicate users
- Check Bold Reports admin panel to see if users already exist
- Run with `-WhatIf` first to preview

### Issue: Rate limiting / Timeouts

**Solution**: Increase delay between requests
```powershell
.\Add-BoldReportsUsers.ps1 -Token "bearer ..." -DelayMs 2000
```

---

## Users Being Created (20 Total)

### AlphaCorp (5 users)
| Email | Username | Name | Role |
|-------|----------|------|------|
| alpha1@alphacorp.com | anna.smith | Anna Smith | Admin |
| alpha2@alphacorp.com | john.doe | John Doe | Sales |
| alpha3@alphacorp.com | linda.lee | Linda Lee | Finance |
| alpha4@alphacorp.com | mike.brown | Mike Brown | Support |
| alpha5@alphacorp.com | chris.green | Chris Green | Operations |

### Beta Solutions (5 users)
| Email | Username | Name | Role |
|-------|----------|------|------|
| beta1@betasolutions.com | betty.jones | Betty Jones | Admin |
| beta2@betasolutions.com | julia.king | Julia King | Sales |
| beta3@betasolutions.com | brian.adams | Brian Adams | Finance |
| beta4@betasolutions.com | diana.miller | Diana Miller | Support |
| beta5@betasolutions.com | eliza.scott | Eliza Scott | Operations |

### Delta Enterprises (5 users)
| Email | Username | Name | Role |
|-------|----------|------|------|
| delta1@deltaenterprises.com | megan.young | Megan Young | Admin |
| delta2@deltaenterprises.com | zoe.turner | Zoe Turner | Sales |
| delta3@deltaenterprises.com | ryan.evans | Ryan Evans | Finance |
| delta4@deltaenterprises.com | liam.cooper | Liam Cooper | Support |
| delta5@deltaenterprises.com | emma.hall | Emma Hall | Operations |

### Gamma Industries (5 users)
| Email | Username | Name | Role |
|-------|----------|------|------|
| gamma1@gammaindustries.com | george.william | George William | Admin |
| gamma2@gammaindustries.com | jack.black | Jack Black | Sales |
| gamma3@gammaindustries.com | olivia.martin | Olivia Martin | Finance |
| gamma4@gammaindustries.com | sophia.white | Sophia White | Support |
| gamma5@gammaindustries.com | noah.clark | Noah Clark | Operations |

---

## Script Features

✅ **Bulk User Creation** - All 20 users in one execution  
✅ **Error Handling** - Continues on failures, reports summary  
✅ **Rate Limiting** - Configurable delay between requests  
✅ **Connection Testing** - Verifies API connectivity before starting  
✅ **Colored Output** - Easy-to-read status messages  
✅ **Dry Run Mode** - Preview with `-WhatIf` flag  
✅ **Industry Grouping** - Organized output by company  
✅ **Summary Report** - Success/failure statistics  
✅ **Exit Codes** - 0 = Success, 1 = Partial, 2 = Failed  

---

## Security Notes

⚠️ **Token Security**:
- Store token in environment variable for production use
- Never commit token to version control
- Rotate tokens regularly
- Check token expiration before running script

```powershell
# Example: Store token in environment variable
$env:BOLD_REPORTS_TOKEN = "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
.\Add-BoldReportsUsers.ps1 -Token $env:BOLD_REPORTS_TOKEN
```

---

## Support & References

- **Bold Reports Docs**: https://help.boldreports.com/
- **Rest API Reference**: https://help.boldreports.com/enterprise-reporting/rest-api-reference/
- **User Management**: https://help.boldreports.com/enterprise-reporting/administrator-guide/manage-users/

---

## Log Output

To save script output to a file:

```powershell
.\Add-BoldReportsUsers.ps1 -Token "bearer ..." | Tee-Object -FilePath "user-creation-$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
```

---

**Last Updated**: 2026-09-08  
**Version**: 1.0  
**Author**: BoldAdhocEmbed Team
