# Backend API Endpoints - Quick Reference

## ✅ All Endpoints Implemented

Base URL: `http://localhost:8080/api` (Docker) or `https://localhost:7029/api` (Local Dev)

---

## REPORTS API (`/api/reports/*`)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | `/reports/viewer-settings` | Get viewer configuration | ✅ Implemented |
| GET | `/reports/embed-token` | Generate embed token | ✅ Implemented |
| GET | `/reports/tree` | Get categorized reports | ✅ Implemented |
| GET | `/reports/{id}` | Get report details | ✅ Implemented |
| POST | `/reports/export` | Export report | ✅ Implemented |
| POST | `/reports/Delete` | Delete report | ✅ Implemented |

---

## SCHEDULES API (`/api/schedules/*`)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | `/schedules` | List all schedules | ✅ Implemented |
| GET | `/schedules/GetSchedules` | List schedules (alias) | ✅ Implemented |
| GET | `/schedules/detail/{id}` | Get schedule details | ✅ Implemented |
| POST | `/schedules/create` | Create schedule | ✅ Implemented |
| PUT | `/schedules/{id}` | Update schedule | ✅ Implemented |
| DELETE | `/schedules/{id}` | Delete schedule | ✅ Implemented |
| POST | `/schedules/{id}/run` | Run schedule now | ✅ Implemented |

---

## DASHBOARDS API (`/api/dashboards/*`)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/dashboards/token` | Get BI token | ✅ Implemented |
| GET | `/dashboards/list` | List dashboards | ✅ Implemented |
| GET | `/dashboards/{id}` | Get dashboard | ✅ Implemented |

---

## USERS API (`/api/users/*`)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | `/users` | List all users | ✅ Implemented |
| GET | `/users/{email}` | Get user details | ✅ Implemented |
| POST | `/users` | Create user | ✅ Implemented |
| PUT | `/users/{email}` | Update user | ✅ Implemented |
| DELETE | `/users/{email}` | Delete user | ✅ Implemented |
| GET | `/users/groups` | Get groups | ✅ Implemented |

---

## AUTH API (`/api/auth/*`)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/auth/login` | Login | ✅ Implemented |
| POST | `/auth/logout` | Logout | ✅ Implemented |
| POST | `/auth/refresh` | Refresh token | ✅ Implemented |
| GET | `/auth/validate` | Validate token | ✅ Implemented |
| GET | `/auth/user` | Get current user | ✅ Implemented |

---

## CRM API (`/api/crm/*`)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | `/crm/organizations` | List organizations | ✅ Implemented |
| GET | `/crm/accounts/{tenant}` | Get tenant accounts | ✅ Implemented |
| GET | `/crm/contacts/{tenant}` | Get tenant contacts | ✅ Implemented |

---

## HOME API (`/api/home/*`)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | `/home/status` | App health status | ✅ Implemented |

---

## Common Request Headers

All requests should include:
```
Authorization: Bearer {token}
Content-Type: application/json
```

Optional headers (for context):
```
X-User-Email: user@example.com
X-Tenant-Name: tenant-name
X-User-Role: Admin
X-User-Region: US
```

---

## Common Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "data": null
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (access denied) |
| 404 | Not Found |
| 500 | Server Error |
| 503 | Service Unavailable |

---

## Testing with PowerShell

### Get Reports
```powershell
$token = "your-bearer-token"
$headers = @{ "Authorization" = "Bearer $token" }

Invoke-WebRequest -Uri http://localhost:8080/api/reports/tree `
    -Method Get `
    -Headers $headers | ConvertFrom-Json
```

### Get Schedules
```powershell
Invoke-WebRequest -Uri http://localhost:8080/api/schedules `
    -Method Get `
    -Headers $headers | ConvertFrom-Json
```

### Get Dashboard Token
```powershell
$body = @{ userEmail = "user@example.com" } | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:8080/api/dashboards/token `
    -Method Post `
    -Headers $headers `
    -Body $body `
    -ContentType application/json | ConvertFrom-Json
```

---

## Frontend Integration

Frontend calls these APIs via:

1. **API Service Layer** (`src/services/apiService.js`)
   - Handles HTTP requests
   - Automatic Authorization header
   - Response unwrapping

2. **Data Context** (`src/context/DataContext.jsx`)
   - Caching layer
   - Global state management
   - Prevents duplicate API calls

3. **Components** (React pages)
   - Use `useData()` hook
   - Call functions like `getReports()`, `getSchedules()`
   - Render data from state

### Example: Getting Reports in Frontend
```javascript
const { getReports } = useData();

useEffect(() => {
  const load = async () => {
    const tree = await getReports(); // Calls /api/reports/tree
    setReports(tree);
  };
  load();
}, []);
```

---

## Backend Files Reference

### Controllers
- `Controllers/ReportsController.cs` - Reports endpoints
- `Controllers/SchedulesController.cs` - Schedules endpoints
- `Controllers/DashboardsController.cs` - Dashboard endpoints
- `Controllers/UsersController.cs` - User management endpoints
- `Controllers/AuthController.cs` - Authentication endpoints
- `Controllers/CrmController.cs` - CRM data endpoints
- `Controllers/HomeController.cs` - Health check endpoints

### Services
- `Services/BoldReportsService.cs` - Bold Reports API integration
- `Services/BoldBIDashboardService.cs` - Bold BI API integration
- `Services/CacheService.cs` - Caching implementation
- `Services/CrmDataService.cs` - PostgreSQL data access
- `Services/TokenHelper.cs` - Token management

### Configuration
- `Program.cs` - DI setup, CORS, middleware
- `appsettings.json` - Default configuration
- `appsettings.Development.json` - Dev overrides
- `appsettings.Production.json` - Prod overrides

---

## Verification Commands

```bash
# Check if server is running
curl -i http://localhost:8080/api/home/status

# View server logs
docker-compose logs -f bdsadhoc

# Check all containers
docker-compose ps

# Verify API is responding
Invoke-WebRequest -Uri http://localhost:8080/api/home/status
```

---

## SUMMARY

✅ **Total Endpoints Implemented**: 30+
✅ **Controllers**: 7 fully implemented
✅ **Services**: 5 complete
✅ **Authentication**: Configured
✅ **Error Handling**: Global middleware
✅ **Caching**: Implemented
✅ **CORS**: Enabled for frontend
✅ **Logging**: Active

**Status**: BACKEND API FULLY IMPLEMENTED AND READY
