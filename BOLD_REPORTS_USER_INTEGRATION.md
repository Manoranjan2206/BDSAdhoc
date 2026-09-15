# Bold Reports Server - User Integration Guide

## Overview
This document provides the API requests to add all 20 CRM users (from 4 industries) to the Bold Reports Server.

---

## API Configuration

### Endpoint
```
Self-Hosted Server: https://adhoc.boldreports.com/reporting/api/site/site11/v1.0/users
```

### Site Details
- **Site Name**: `site11`
- **Base URL**: `https://adhoc.boldreports.com/reporting/site/site11/`

### Authentication
- **Bearer Token**:
```
bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im1hbm9yYW5qYW4ucmFqZW5kcmFuQHN5bmNmdXNpb24uY29tIiwibmFtZWlkIjoiMiIsInVuaXF1ZV9uYW1lIjoiYmFkMTViMDEtMjhmNy00ZWJmLTllYjctNjA3ZGRmNmI1YWFjIiwiSVAiOiIxNzIuMTguMC4zIiwiaXNzdWVkX2RhdGUiOiIxNzg4ODYzODc5IiwibmJmIjoxNzg4ODYzODc5LCJleHAiOjE3ODk1MTY4MDAsImlhdCI6MTc4ODg2Mzg3OSwiaXNzIjoiaHR0cHM6Ly9hZGhvYy5ib2xkcmVwb3J0cy5jb20vcmVwb3J0aW5nL3NpdGUvc2l0ZTExIiwiYXVkIjoiaHR0cHM6Ly9hZGhvYy5ib2xkcmVwb3J0cy5jb20vcmVwb3J0aW5nL3NpdGUvc2l0ZTExIn0.xg0lAqfd2qfBtfI4BEUvXBrYCOjdodLvoNU1XYtpE8w
```

### Default Password
```
Admin@123
```

---

## Request Schema

### Request Method
`POST` to `/v1.0/users`

### Request Headers
```
Authorization: bearer {token}
Content-Type: application/json
```

### Request Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Email | string | ✅ Yes | Email address of the user |
| UserName | string | ✅ Yes | Username of the user (must be unique) |
| FirstName | string | ✅ Yes | First name of the user |
| LastName | string | ❌ No | Last name of the user |
| Password | string | ❌ No | Password (in Automatic activation mode) |

---

## User Integration Requests

### 1. AlphaCorp Tenant Users (5 users)

#### User 1: Anna Smith - Admin
```json
{
  "Email": "alpha1@alphacorp.com",
  "UserName": "anna.smith",
  "FirstName": "Anna",
  "LastName": "Smith",
  "Password": "Admin@123"
}
```

#### User 2: John Doe - Sales
```json
{
  "Email": "alpha2@alphacorp.com",
  "UserName": "john.doe",
  "FirstName": "John",
  "LastName": "Doe",
  "Password": "Admin@123"
}
```

#### User 3: Linda Lee - Finance
```json
{
  "Email": "alpha3@alphacorp.com",
  "UserName": "linda.lee",
  "FirstName": "Linda",
  "LastName": "Lee",
  "Password": "Admin@123"
}
```

#### User 4: Mike Brown - Support
```json
{
  "Email": "alpha4@alphacorp.com",
  "UserName": "mike.brown",
  "FirstName": "Mike",
  "LastName": "Brown",
  "Password": "Admin@123"
}
```

#### User 5: Chris Green - Operations
```json
{
  "Email": "alpha5@alphacorp.com",
  "UserName": "chris.green",
  "FirstName": "Chris",
  "LastName": "Green",
  "Password": "Admin@123"
}
```

---

### 2. Beta Solutions Tenant Users (5 users)

#### User 1: Betty Jones - Admin
```json
{
  "Email": "beta1@betasolutions.com",
  "UserName": "betty.jones",
  "FirstName": "Betty",
  "LastName": "Jones",
  "Password": "Admin@123"
}
```

#### User 2: Julia King - Sales
```json
{
  "Email": "beta2@betasolutions.com",
  "UserName": "julia.king",
  "FirstName": "Julia",
  "LastName": "King",
  "Password": "Admin@123"
}
```

#### User 3: Brian Adams - Finance
```json
{
  "Email": "beta3@betasolutions.com",
  "UserName": "brian.adams",
  "FirstName": "Brian",
  "LastName": "Adams",
  "Password": "Admin@123"
}
```

#### User 4: Diana Miller - Support
```json
{
  "Email": "beta4@betasolutions.com",
  "UserName": "diana.miller",
  "FirstName": "Diana",
  "LastName": "Miller",
  "Password": "Admin@123"
}
```

#### User 5: Eliza Scott - Operations
```json
{
  "Email": "beta5@betasolutions.com",
  "UserName": "eliza.scott",
  "FirstName": "Eliza",
  "LastName": "Scott",
  "Password": "Admin@123"
}
```

---

### 3. Delta Enterprises Tenant Users (5 users)

#### User 1: Megan Young - Admin
```json
{
  "Email": "delta1@deltaenterprises.com",
  "UserName": "megan.young",
  "FirstName": "Megan",
  "LastName": "Young",
  "Password": "Admin@123"
}
```

#### User 2: Zoe Turner - Sales
```json
{
  "Email": "delta2@deltaenterprises.com",
  "UserName": "zoe.turner",
  "FirstName": "Zoe",
  "LastName": "Turner",
  "Password": "Admin@123"
}
```

#### User 3: Ryan Evans - Finance
```json
{
  "Email": "delta3@deltaenterprises.com",
  "UserName": "ryan.evans",
  "FirstName": "Ryan",
  "LastName": "Evans",
  "Password": "Admin@123"
}
```

#### User 4: Liam Cooper - Support
```json
{
  "Email": "delta4@deltaenterprises.com",
  "UserName": "liam.cooper",
  "FirstName": "Liam",
  "LastName": "Cooper",
  "Password": "Admin@123"
}
```

#### User 5: Emma Hall - Operations
```json
{
  "Email": "delta5@deltaenterprises.com",
  "UserName": "emma.hall",
  "FirstName": "Emma",
  "LastName": "Hall",
  "Password": "Admin@123"
}
```

---

### 4. Gamma Industries Tenant Users (5 users)

#### User 1: George William - Admin
```json
{
  "Email": "gamma1@gammaindustries.com",
  "UserName": "george.william",
  "FirstName": "George",
  "LastName": "William",
  "Password": "Admin@123"
}
```

#### User 2: Jack Black - Sales
```json
{
  "Email": "gamma2@gammaindustries.com",
  "UserName": "jack.black",
  "FirstName": "Jack",
  "LastName": "Black",
  "Password": "Admin@123"
}
```

#### User 3: Olivia Martin - Finance
```json
{
  "Email": "gamma3@gammaindustries.com",
  "UserName": "olivia.martin",
  "FirstName": "Olivia",
  "LastName": "Martin",
  "Password": "Admin@123"
}
```

#### User 4: Sophia White - Support
```json
{
  "Email": "gamma4@gammaindustries.com",
  "UserName": "sophia.white",
  "FirstName": "Sophia",
  "LastName": "White",
  "Password": "Admin@123"
}
```

#### User 5: Noah Clark - Operations
```json
{
  "Email": "gamma5@gammaindustries.com",
  "UserName": "noah.clark",
  "FirstName": "Noah",
  "LastName": "Clark",
  "Password": "Admin@123"
}
```

---

## PowerShell Script - Bulk User Creation

You can use this PowerShell script to add all 20 users to Bold Reports Server:

```powershell
# Bold Reports Configuration
$endpoint = "https://adhoc.boldreports.com/reporting/api/site/site11/v1.0/users"
$token = "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im1hbm9yYW5qYW4ucmFqZW5kcmFuQHN5bmNmdXNpb24uY29tIiwibmFtZWlkIjoiMiIsInVuaXF1ZV9uYW1lIjoiYmFkMTViMDEtMjhmNy00ZWJmLTllYjctNjA3ZGRmNmI1YWFjIiwiSVAiOiIxNzIuMTguMC4zIiwiaXNzdWVkX2RhdGUiOiIxNzg4ODYzODc5IiwibmJmIjoxNzg4ODYzODc5LCJleHAiOjE3ODk1MTY4MDAsImlhdCI6MTc4ODg2Mzg3OSwiaXNzIjoiaHR0cHM6Ly9hZGhvYy5ib2xkcmVwb3J0cy5jb20vcmVwb3J0aW5nL3NpdGUvc2l0ZTExIiwiYXVkIjoiaHR0cHM6Ly9hZGhvYy5ib2xkcmVwb3J0cy5jb20vcmVwb3J0aW5nL3NpdGUvc2l0ZTExIn0.xg0lAqfd2qfBtfI4BEUvXBrYCOjdodLvoNU1XYtpE8w"

# Headers
$headers = @{
    "Authorization" = $token
    "Content-Type"  = "application/json"
}

# User data - All 4 Industries (20 users)
$users = @(
    # AlphaCorp Users
    @{ Email = "alpha1@alphacorp.com"; UserName = "anna.smith"; FirstName = "Anna"; LastName = "Smith"; Password = "Admin@123" },
    @{ Email = "alpha2@alphacorp.com"; UserName = "john.doe"; FirstName = "John"; LastName = "Doe"; Password = "Admin@123" },
    @{ Email = "alpha3@alphacorp.com"; UserName = "linda.lee"; FirstName = "Linda"; LastName = "Lee"; Password = "Admin@123" },
    @{ Email = "alpha4@alphacorp.com"; UserName = "mike.brown"; FirstName = "Mike"; LastName = "Brown"; Password = "Admin@123" },
    @{ Email = "alpha5@alphacorp.com"; UserName = "chris.green"; FirstName = "Chris"; LastName = "Green"; Password = "Admin@123" },
    
    # Beta Solutions Users
    @{ Email = "beta1@betasolutions.com"; UserName = "betty.jones"; FirstName = "Betty"; LastName = "Jones"; Password = "Admin@123" },
    @{ Email = "beta2@betasolutions.com"; UserName = "julia.king"; FirstName = "Julia"; LastName = "King"; Password = "Admin@123" },
    @{ Email = "beta3@betasolutions.com"; UserName = "brian.adams"; FirstName = "Brian"; LastName = "Adams"; Password = "Admin@123" },
    @{ Email = "beta4@betasolutions.com"; UserName = "diana.miller"; FirstName = "Diana"; LastName = "Miller"; Password = "Admin@123" },
    @{ Email = "beta5@betasolutions.com"; UserName = "eliza.scott"; FirstName = "Eliza"; LastName = "Scott"; Password = "Admin@123" },
    
    # Delta Enterprises Users
    @{ Email = "delta1@deltaenterprises.com"; UserName = "megan.young"; FirstName = "Megan"; LastName = "Young"; Password = "Admin@123" },
    @{ Email = "delta2@deltaenterprises.com"; UserName = "zoe.turner"; FirstName = "Zoe"; LastName = "Turner"; Password = "Admin@123" },
    @{ Email = "delta3@deltaenterprises.com"; UserName = "ryan.evans"; FirstName = "Ryan"; LastName = "Evans"; Password = "Admin@123" },
    @{ Email = "delta4@deltaenterprises.com"; UserName = "liam.cooper"; FirstName = "Liam"; LastName = "Cooper"; Password = "Admin@123" },
    @{ Email = "delta5@deltaenterprises.com"; UserName = "emma.hall"; FirstName = "Emma"; LastName = "Hall"; Password = "Admin@123" },
    
    # Gamma Industries Users
    @{ Email = "gamma1@gammaindustries.com"; UserName = "george.william"; FirstName = "George"; LastName = "William"; Password = "Admin@123" },
    @{ Email = "gamma2@gammaindustries.com"; UserName = "jack.black"; FirstName = "Jack"; LastName = "Black"; Password = "Admin@123" },
    @{ Email = "gamma3@gammaindustries.com"; UserName = "olivia.martin"; FirstName = "Olivia"; LastName = "Martin"; Password = "Admin@123" },
    @{ Email = "gamma4@gammaindustries.com"; UserName = "sophia.white"; FirstName = "Sophia"; LastName = "White"; Password = "Admin@123" },
    @{ Email = "gamma5@gammaindustries.com"; UserName = "noah.clark"; FirstName = "Noah"; LastName = "Clark"; Password = "Admin@123" }
)

# Create users
$successCount = 0
$failureCount = 0

foreach ($user in $users) {
    $body = @{
        Email     = $user.Email
        UserName  = $user.UserName
        FirstName = $user.FirstName
        LastName  = $user.LastName
        Password  = $user.Password
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri $endpoint -Method POST -Headers $headers -Body $body
        Write-Host "✓ Created user: $($user.Email)" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "✗ Failed to create user: $($user.Email)" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        $failureCount++
    }
    
    # Rate limiting - wait 500ms between requests
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "User Creation Summary:" -ForegroundColor Cyan
Write-Host "  Total Users: $($users.Count)"
Write-Host "  Successfully Created: $successCount" -ForegroundColor Green
Write-Host "  Failed: $failureCount" -ForegroundColor Red
```

---

## cURL Commands - Individual User Creation

### Example: Add AlphaCorp - Anna Smith

```bash
curl -X POST "https://adhoc.boldreports.com/reporting/api/site/site11/v1.0/users" \
  -H "Authorization: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im1hbm9yYW5qYW4ucmFqZW5kcmFuQHN5bmNmdXNpb24uY29tIiwibmFtZWlkIjoiMiIsInVuaXF1ZV9uYW1lIjoiYmFkMTViMDEtMjhmNy00ZWJmLTllYjctNjA3ZGRmNmI1YWFjIiwiSVAiOiIxNzIuMTguMC4zIiwiaXNzdWVkX2RhdGUiOiIxNzg4ODYzODc5IiwibmJmIjoxNzg4ODYzODc5LCJleHAiOjE3ODk1MTY4MDAsImlhdCI6MTc4ODg2Mzg3OSwiaXNzIjoiaHR0cHM6Ly9hZGhvYy5ib2xkcmVwb3J0cy5jb20vcmVwb3J0aW5nL3NpdGUvc2l0ZTExIiwiYXVkIjoiaHR0cHM6Ly9hZGhvYy5ib2xkcmVwb3J0cy5jb20vcmVwb3J0aW5nL3NpdGUvc2l0ZTExIn0.xg0lAqfd2qfBtfI4BEUvXBrYCOjdodLvoNU1XYtpE8w" \
  -H "Content-Type: application/json" \
  -d '{
    "Email": "alpha1@alphacorp.com",
    "UserName": "anna.smith",
    "FirstName": "Anna",
    "LastName": "Smith",
    "Password": "Admin@123"
  }'
```

---

## Summary Table - All 20 Users

| Industry | User Email | Username | First Name | Last Name | Role |
|----------|-----------|----------|-----------|-----------|------|
| **AlphaCorp** | alpha1@alphacorp.com | anna.smith | Anna | Smith | Admin |
| | alpha2@alphacorp.com | john.doe | John | Doe | Sales |
| | alpha3@alphacorp.com | linda.lee | Linda | Lee | Finance |
| | alpha4@alphacorp.com | mike.brown | Mike | Brown | Support |
| | alpha5@alphacorp.com | chris.green | Chris | Green | Operations |
| **Beta Solutions** | beta1@betasolutions.com | betty.jones | Betty | Jones | Admin |
| | beta2@betasolutions.com | julia.king | Julia | King | Sales |
| | beta3@betasolutions.com | brian.adams | Brian | Adams | Finance |
| | beta4@betasolutions.com | diana.miller | Diana | Miller | Support |
| | beta5@betasolutions.com | eliza.scott | Eliza | Scott | Operations |
| **Delta Enterprises** | delta1@deltaenterprises.com | megan.young | Megan | Young | Admin |
| | delta2@deltaenterprises.com | zoe.turner | Zoe | Turner | Sales |
| | delta3@deltaenterprises.com | ryan.evans | Ryan | Evans | Finance |
| | delta4@deltaenterprises.com | liam.cooper | Liam | Cooper | Support |
| | delta5@deltaenterprises.com | emma.hall | Emma | Hall | Operations |
| **Gamma Industries** | gamma1@gammaindustries.com | george.william | George | William | Admin |
| | gamma2@gammaindustries.com | jack.black | Jack | Black | Sales |
| | gamma3@gammaindustries.com | olivia.martin | Olivia | Martin | Finance |
| | gamma4@gammaindustries.com | sophia.white | Sophia | White | Support |
| | gamma5@gammaindustries.com | noah.clark | Noah | Clark | Operations |

---

## Configuration Details

### Bold Reports Server Configuration
- **Endpoint**: `https://adhoc.boldreports.com/reporting/api/site/site11/v1.0/users`
- **Site**: `site11`
- **Default Password**: `Admin@123` (for all users)
- **Authentication**: Bearer Token (JWT)

### Industries (4 total)
1. ✅ **AlphaCorp** - 5 users
2. ✅ **Beta Solutions** - 5 users
3. ✅ **Delta Enterprises** - 5 users
4. ✅ **Gamma Industries** - 5 users

**Total Users**: 20

---

## Next Steps

1. **Run PowerShell Script**: Execute the provided PowerShell script to bulk create all users
2. **Verify Users**: Check Bold Reports Server admin panel for user creation confirmation
3. **Assign Roles**: Assign appropriate roles to each user based on their function
4. **Configure Permissions**: Set up tenant-level permissions for multi-tenant access

---

**Last Updated**: 2026-09-08  
**Token Expiration**: Check token expiry date before using  
**Support**: Bold Reports Documentation - https://help.boldreports.com/
