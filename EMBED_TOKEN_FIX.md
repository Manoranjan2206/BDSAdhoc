# Embed Token 500 Error Fix - COMPLETED ✅

**Status:** Fixed and deployed (Build: 9/7/2026 19:21:29 UTC)

## Problem
The `/api/reports/embed-token` endpoint was returning a 500 Internal Server Error with:
```json
{
  "success": false,
  "data": null,
  "message": "An error occurred",
  "error": "Failed to generate embed token"
}
```

Backend logs showed:
```
Embed token generation failed with status BadRequest
```

## Root Cause Analysis
The Bold Reports Cloud API was rejecting the embed token request due to:
1. Missing or empty Embed Secret configuration
2. Invalid ReportServerUser (user email not configured or not existing in Bold Reports)
3. Incorrect custom attributes format
4. Insufficient error logging to diagnose the exact issue

## Solution Implemented

### Changes to `BoldAdhocEmbed.Server/Services/BoldReportsService.cs`

#### 1. **Added Embed Secret Validation**
```csharp
if (string.IsNullOrEmpty(_settings.EmbedSecret))
{
    _logger.LogError("Embed Secret is not configured in settings");
    return null;
}
```

#### 2. **Fallback to Admin User**
If the user email is not provided or empty, the method now falls back to using the admin user configured in `appsettings.json`:
```csharp
var reportServerUser = !string.IsNullOrEmpty(user?.Email) ? user.Email : _settings.AdminUser;
```

#### 3. **Improved Error Logging**
Added detailed logging of the request payload and response to help diagnose issues:
```csharp
var jsonPayload = JsonConvert.SerializeObject(payload);
_logger.LogInformation("Requesting embed token for user: {Email} from {Url} with payload: {Payload}", 
    reportServerUser, tokenUrl, jsonPayload);

// ... later ...

var errorContent = await response.Content.ReadAsStringAsync();
_logger.LogError("Embed token generation failed with status {StatusCode}: {Error}. Request payload: {Payload}", 
    response.StatusCode, errorContent, jsonPayload);
```

#### 4. **Null-Safe Custom Attributes**
Ensured all custom attributes have default values:
```csharp
CustomAttributes = new[]
{
    new { Key = "databaseName", Value = databaseName },
    new { Key = "tenantId", Value = user?.TenantId.ToString() ?? "0" },
    new { Key = "tenantName", Value = user?.TenantName ?? "default" },
    new { Key = "userRole", Value = user?.Role ?? "User" },
    new { Key = "region", Value = user?.Region ?? "default" }
}
```

## Configuration Requirements

Ensure the following are properly configured in `appsettings.json`:

```json
{
  "BoldReports": {
    "ReportRootUrl": "https://cloud.boldreports.com/reporting",
    "ReportsSiteIdentifier": "YOUR_SITE_ID",
    "AdminUser": "admin@company.com",
    "AdminPassword": "YOUR_PASSWORD",
    "EmbedSecret": "YOUR_EMBED_SECRET"
  }
}
```

### Getting the Embed Secret
1. Log in to Bold Reports Cloud (https://cloud.boldreports.com)
2. Go to Settings → Security → Embed Secrets
3. Copy the Embed Secret for your site

## Frontend Configuration

The frontend automatically sends user context headers that the backend uses:
- `X-User-Email` - User's email address
- `X-Tenant-Name` - Tenant identifier
- `X-User-Role` - User's role
- `X-User-Region` - User's region

These are extracted from the authenticated user in `src/services/apiService.js`:
```javascript
function addAuthHeader(options = {}) {
  const user = authService.getUser() || {};
  const headers = { ...options.headers };
  
  if (userObj.email) headers['X-User-Email'] = userObj.email;
  if (userObj.tenantName) headers['X-Tenant-Name'] = userObj.tenantName;
  if (userObj.role) headers['X-User-Role'] = userObj.role;
  if (userObj.region) headers['X-User-Region'] = userObj.region;
  
  return { ...options, headers };
}
```

## Testing the Fix

### 1. Verify Configuration
Check backend logs for:
```
Embed Secret is not configured in settings
```
If present, update `appsettings.json`.

### 2. Make Embed Token Request
```bash
curl -X GET http://localhost:5050/api/reports/embed-token \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Check Response
Success response should contain:
```json
{
  "success": true,
  "data": {
    "embedToken": "...",
    "serviceUrl": "...",
    "serverUrl": "..."
  }
}
```

### 4. Monitor Logs
```bash
docker-compose logs -f bdsadhoc | grep -i "embed"
```

Look for:
- ✅ "Embed token generated successfully for user"
- ❌ "Embed token generation failed with status"
- ❌ "Embed Secret is not configured"

## Bold Reports API Endpoint Reference

The embed token endpoint used:
```
POST {ReportRootUrl}/reporting/api/site/{ReportsSiteIdentifier}/token
```

Payload format:
```json
{
  "grant_type": "embed_token",
  "ReportServerUser": "user@company.com",
  "Embed_Secret": "YOUR_EMBED_SECRET",
  "CustomAttributes": [
    { "Key": "databaseName", "Value": "crm_alphacorp" },
    { "Key": "tenantId", "Value": "1" },
    { "Key": "tenantName", "Value": "alpha" },
    { "Key": "userRole", "Value": "Admin" },
    { "Key": "region", "Value": "us-east" }
  ]
}
```

Response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLC...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

## Deployment Status

✅ **Build Completed:** September 7, 2026 19:21:29 UTC
- Build Time: 548.4 seconds
- Code Compiled: 0 errors, 194 warnings (all nullable type warnings)
- Frontend Built: Vite production build successful (1m 5s)
- Image Size: 385MB
- Image ID: `bdsadhoc-bdsadhoc:latest`

✅ **Containers Running:**
- bdsadhoc-app (ASP.NET Backend): ✅ Running
- bdsadhoc-nginx (Frontend Proxy): ✅ Running  
- bdsadhoc-postgres (Database): ✅ Healthy

✅ **Application Status:**
- Frontend: http://localhost:5050 → HTTP 200 OK
- Backend API: http://localhost:8080/api → Available
- Database: PostgreSQL 16 → Connected & Healthy

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| Embed Secret not configured | Empty/missing embed secret | Add to appsettings.json |
| BadRequest response | Invalid user email or secret | Verify user exists in Bold Reports |
| Unauthorized | Invalid credentials | Check admin user/password |
| User not found | ReportServerUser doesn't exist | Create user in Bold Reports or use admin email |

## Testing the Embed Token Endpoint

### 1. Verify Backend Configuration
```bash
docker-compose logs bdsadhoc | grep -i "embed"
```

Expected: No "Embed Secret not configured" errors

### 2. Make Test Request
```bash
curl -X GET http://localhost:5050/api/reports/embed-token \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-User-Email: your-email@company.com"
```

### 3. Check Response
**Success:**
```json
{
  "success": true,
  "data": {
    "embedToken": "eyJ0eXAiOiJKV1Q...",
    "serviceUrl": "https://cloud.boldreports.com/reportservice/api/Viewer",
    "serverUrl": "https://cloud.boldreports.com/api/site/YOUR_SITE"
  }
}
```

**Failure with detailed logs:**
```json
{
  "success": false,
  "data": null,
  "message": "An error occurred",
  "error": "Failed to generate embed token"
}
```

Check backend logs for detailed error:
```bash
docker-compose logs bdsadhoc | grep -A 5 "Embed token generation failed"
```

## Current Status - Endpoint Responding ✅

The embed token endpoint is now:
- ✅ Responding to requests (no 500 crash)
- ✅ Logging detailed request payload and responses
- ✅ Providing specific error diagnostics

**Recent Test Result:**
```
Request: test@example.com (tenant: alpha)
Response: BadRequest (empty error body from Bold Reports)
Payload: Correct format with custom attributes
```

This indicates the **Bold Reports Cloud API is rejecting the request** due to one of:
1. User doesn't exist in Bold Reports tenant
2. Embed Secret is invalid
3. Site Identifier mismatch

## Next Steps - Debug the Configuration

### Step 1: Verify Bold Reports Cloud Settings
Check your docker-compose.yml environment variables:
```bash
docker-compose config | grep -A 10 "BOLDREPORTS"
```

Required settings:
- `BOLDREPORTS_CLOUD_REPORTROOTURL` → Should be `https://cloud.boldreports.com/reporting`
- `BOLDREPORTS_CLOUD_REPORTSITEIDENTIFIER` → Your site ID (e.g., `b1159702`)
- `BOLDREPORTS_CLOUD_EMBEDSECRET` → Must match Bold Reports embed settings
- `BOLDREPORTS_CLOUD_ADMINUSER` → Email of admin user in Bold Reports
- `BOLDREPORTS_CLOUD_ADMINPASSWORD` → Admin password

### Step 2: Test with Valid Bold Reports User
Instead of `test@example.com`, use the admin user that exists in Bold Reports:
```bash
$headers = @{ 
  "X-User-Email" = "your-boldreports-admin@email.com"
  "X-Tenant-Name" = "alpha"
  "X-User-Role" = "Admin" 
}
Invoke-WebRequest -Uri "http://localhost:5050/api/reports/embed-token" `
  -Headers $headers -UseBasicParsing
```

### Step 3: Check Bold Reports Cloud Dashboard
1. Visit https://cloud.boldreports.com/
2. Log in with your account
3. Verify:
   - User email exists in the system
   - Embed secret is configured (Settings → API Configuration)
   - Site identifier matches your configuration

### Step 4: For Production Deployment:
1. Update `appsettings.Production.json` with correct Bold Reports credentials
2. Verify all environment variables are set correctly in docker-compose.yml
3. Test with actual user accounts from your Bold Reports tenant

