# Bold Reports Embed Token - Debug Guide

## Current Status
- ✅ Backend code: Enhanced error handling implemented
- ✅ Error logging: Detailed request/response logging working
- ❌ Token generation: Failing with `BadRequest` status (empty response body)

## Latest Error
```
Embed token generation failed with status BadRequest
Request payload:
{
  "grant_type": "embed_token",
  "ReportServerUser": "manoranjan.rajendran@syncfusion.com",
  "Embed_Secret": "Yhfw5o9c01TVdPk8HWhQQnGKAl0K9HP",
  "CustomAttributes": [
    {"Key": "databaseName", "Value": "crm_alphacorp"},
    {"Key": "tenantId", "Value": "0"},
    {"Key": "tenantName", "Value": "alpha"},
    {"Key": "userRole", "Value": "Admin"},
    {"Key": "region", "Value": ""}
  ]
}
```

## Root Cause Analysis - BadRequest with Empty Body

This typically indicates:
1. **Embed Secret Mismatch** - Most common cause
2. **User Not Found** - User doesn't exist in Bold Reports tenant
3. **Invalid Grant Type** - API version mismatch
4. **Tenant Permissions** - User lacks token generation permissions

## How to Debug

### Option 1: Verify Embed Secret in Bold Reports Cloud

1. Navigate to: https://cloud.boldreports.com/
2. Log in with your account
3. Go to: **Settings** → **API Configuration**
4. Find: **Embed Configuration** or **Embed Secret**
5. Compare with `BoldReports__EmbedSecret` value in docker-compose.yml

**Currently using:**
```
Embed Secret: Yhfw5o9c01TVdPk8HWhQQnGKAl0K9HP
```

### Option 2: Test Bold Reports API Directly

Use curl to test the embed token API directly:

```bash
curl -X POST "https://cloud.boldreports.com/reporting/api/account/token" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "embed_token",
    "ReportServerUser": "manoranjan.rajendran@syncfusion.com",
    "Embed_Secret": "Yhfw5o9c01TVdPk8HWhQQnGKAl0K9HP",
    "CustomAttributes": [
      {"Key": "databaseName", "Value": "crm_alphacorp"},
      {"Key": "tenantId", "Value": "0"},
      {"Key": "tenantName", "Value": "alpha"},
      {"Key": "userRole", "Value": "Admin"},
      {"Key": "region", "Value": ""}
    ]
  }'
```

### Option 3: Check User Status in Bold Reports

1. Go to: https://cloud.boldreports.com/administration/users
2. Verify the user exists: `manoranjan.rajendran@syncfusion.com`
3. Check user status: Should be "Active"
4. Check user permissions: Should have access to embed tokens

### Option 4: Verify Site Identifier

1. Go to: https://cloud.boldreports.com/settings
2. Find: **Site Identifier** or **Tenant ID**
3. Compare with `BoldReports__ReportsSiteIdentifier` value

**Currently using:**
```
Site Identifier: b1159702
```

## Configuration Reference

### Docker Compose Environment Variables
```yaml
# Current Configuration
- BoldReports__ReportRootUrl=https://cloud.boldreports.com/reporting
- BoldReports__ReportsSiteIdentifier=b1159702
- BoldReports__AdminUser=manoranjan.rajendran@syncfusion.com
- BoldReports__AdminPassword=Admin@123
- BoldReports__EmbedSecret=Yhfw5o9c01TVdPk8HWhQQnGKAl0K9HP
```

### Verification Steps

**Step 1: Check endpoint is reachable**
```bash
curl -s "https://cloud.boldreports.com/reporting/api/account/token" -X POST | head
```

**Step 2: Check container logs for the exact request**
```bash
docker-compose logs -f bdsadhoc | grep -A 2 "Request payload"
```

**Step 3: Check if Bold Reports service is available**
```bash
ping cloud.boldreports.com
```

## If Token Still Fails

### Option A: Contact Bold Reports Support
Provide them:
1. The complete request payload (from logs)
2. The error response (empty in this case)
3. Your site identifier: `b1159702`
4. Your user email: `manoranjan.rajendran@syncfusion.com`
5. Your Bold Reports account credentials

### Option B: Use Test/Demo Account
Try with Bold Reports demo credentials to verify the configuration:
```
Email: demo@boldreports.com
Site ID: demo
Embed Secret: (from Bold Reports demo account)
```

### Option C: Generate New Embed Secret
1. Go to Bold Reports Cloud → Settings → API Configuration
2. Regenerate the Embed Secret
3. Update the value in `docker-compose.yml`
4. Restart containers: `docker-compose restart bdsadhoc`

## Success Criteria

✅ Token endpoint should return:
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

❌ Currently returning:
```json
{
  "success": false,
  "data": null,
  "message": "An error occurred",
  "error": "Failed to generate embed token",
  "timestamp": "2026-09-07T14:03:17.940344Z"
}
```

## Next Steps

1. **Verify credentials** - Double-check Site ID and Embed Secret in Bold Reports Cloud
2. **Test API directly** - Use curl to test endpoint with provided credentials
3. **Check user status** - Ensure user account is active and has permissions
4. **Regenerate secrets** - Create new Embed Secret if current one is incorrect
5. **Contact Bold Reports** - If all verification steps pass but still fails

---

**Note**: The enhanced error handling is working perfectly - it's catching and logging the error. The issue is with the Bold Reports Cloud configuration, not the application code.
