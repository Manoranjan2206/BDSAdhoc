# API Integration Notes - Complete Architecture

## Overview
The application is completely API-driven, fetching all data from Bold Reports REST APIs. No hardcoded data is used - all categories, reports, schedules, dashboards, and users are fetched from the backend.

## Data Flow Architecture

```
Frontend Components (React)
        ↓
useData() Context Hook
        ↓
API Service Layer (apiService.js)
        ↓
Controllers (DashboardsController, ReportsController, etc.)
        ↓
BoldReportsService / BoldBIDashboardService
        ↓
Bold Reports / Bold BI REST APIs
```

## Frontend Data Fetching

### 1. DataContext (Global State Management)
**File**: `src/context/DataContext.jsx`
- Centralizes all API calls
- Implements caching to avoid duplicate requests
- Provides `useData()` hook for components

### 2. API Service Layer
**File**: `src/services/apiService.js`
- `reportsAPI.getReportTree()` - Fetches categorized reports
- `schedulesAPI.getSchedules()` - Fetches all schedules
- `dashboardsAPI.getList()` - Fetches dashboards
- `usersAPI.getUsers()` - Fetches users

### 3. Component Usage
**Example from Schedules.jsx**:
```javascript
const { getSchedules, getReports, getDashboards } = useData();

useEffect(() => {
  const load = async () => {
    const [list, tree, dashboards] = await Promise.all([
      getSchedules(),      // Fetches from API
      getReports(),        // Fetches from API
      getDashboards(),     // Fetches from API
    ]);
    
    setSchedules(Array.isArray(list) ? list : []);
    // ... process tree and dashboards
  };
  load();
}, []);
```

## Backend API Endpoints

### Bold Reports Items API (Categories & Reports)
- **Endpoint**: `https://{domain}/reporting/api/site/{tenant}/v5.0/items`
- **Method**: GET
- **Query Parameters**:
  - `itemType`: `Category` or `Report`
  - `serverPath`: Optional category path
  - `tags`: Optional comma-separated tags
- **Headers**: `Authorization: Bearer {token}`
- **Response**: List of items with metadata

**Response Example**:
```json
{
  "Id": "report-123",
  "ItemType": 1,
  "Name": "Sales Report",
  "Description": "Monthly sales analysis",
  "CategoryName": "Sales",
  "CreatedDate": "2026-01-15T10:30:00Z",
  "ModifiedDate": "2026-09-07T14:22:00Z",
  "CanRead": true,
  "CanWrite": false,
  "CanDelete": false,
  "CanSchedule": true
}
```

### Backend Processing (Categories & Reports)
**File**: `BoldAdhocEmbed.Server/Controllers/ReportsController.cs`

**Endpoint**: `GET /api/reports/tree`
1. Fetches all reports from Bold Reports API using user's token
2. Groups reports by `CategoryName`
3. Returns hierarchical structure:
```javascript
[
  {
    "Id": "sales",
    "Name": "Sales",
    "Reports": [
      {
        "Id": "rpt-001",
        "Name": "Sales Report",
        "Description": "...",
        "CreatedDate": "...",
        "ModifiedDate": "..."
      }
    ]
  }
]
```

### Schedules Management API
- **Endpoint**: `/api/site/{tenant-name}/v5.0/reports/schedule/items`
- **Method**: GET
- **Response**: List of BoldSchedule objects
- **Backend**: `BoldReportsService.GetSchedulesAsync()`

### Schedule Details
- **Endpoint**: `/api/site/{tenant-name}/v5.0/reports/schedule?scheduleId={scheduleId}`
- **Method**: GET
- **Response**: BoldScheduleDetail object
- **Backend**: `BoldReportsService.GetScheduleDetailAsync()`

### Create Schedule
- **Endpoint**: `/api/site/{tenant-name}/v1.0/reports/schedule`
- **Method**: POST
- **Payload**: Schedule configuration
- **Backend**: `BoldReportsService.CreateScheduleAsync()`

### Update Schedule
- **Endpoint**: `/api/site/{tenant-name}/v1.0/reports/schedule/{scheduleId}`
- **Method**: PUT
- **Payload**: Updated configuration
- **Backend**: `BoldReportsService.UpdateScheduleAsync()`

### Run Schedule Now
- **Endpoint**: `/api/site/{tenant-name}/v1.0/schedules/{scheduleId}/run`
- **Method**: GET
- **Backend**: `BoldReportsService.RunScheduleNowAsync()`

### Delete Schedule
- **Endpoint**: `/api/site/{tenant-name}/v1.0/items/{scheduleId}`
- **Method**: DELETE
- **Backend**: `BoldReportsService.DeleteScheduleAsync()`

## Frontend Changes - Hardcoded Data Removal

### Schedules Component
- **Before**: `DEFAULT_SCHEDULES` constant with 4 hardcoded example schedules
- **After**: Removed entirely, uses `getSchedules()` from API

### Reports Component
- **Before**: `DEFAULT_REPORT_TREE` with 7 hardcoded reports across 3 categories
- **After**: Removed entirely, uses `getReports()` from API

### Implementation
- All components now fetch from backend API
- Empty array fallback when API is unavailable
- Real-time updates when data is created/modified/deleted
- Components use `useData()` context hook for all data fetching

## Key Files Modified

1. **`boldadhocembed.client/src/pages/Schedules.jsx`**
   - Removed DEFAULT_SCHEDULES constant
   - Updated fallback logic to use empty arrays
   - Component now entirely API-driven

2. **Backend (Already Implemented)**
   - `BoldAdhocEmbed.Server/Services/BoldReportsService.cs`
   - Implements all schedule management methods
   - Uses Bold Reports v5.0 API endpoints

## Data Flow

```
Frontend (Schedules.jsx)
    ↓
useData() hook → getSchedules()
    ↓
Backend (SchedulesController.cs)
    ↓
BoldReportsService.GetSchedulesAsync()
    ↓
Bold Reports REST API
    ↓
Returns: List<BoldSchedule>
```

## Authentication
- All API calls include Bearer token in Authorization header
- Token obtained from Bold Reports server using credentials
- Token lifecycle managed by authentication service

## Notes
- Component handles empty schedule lists gracefully
- API errors don't crash the component
- Loading states properly displayed
- All schedule operations (CRUD) use API endpoints

---

## Verification: NO HARDCODED DATA

To confirm that all data is API-driven (not hardcoded), search for these patterns in the codebase:

### ✅ Categories & Reports
- **Status**: FULLY API-DRIVEN
- **Source**: Bold Reports v5.0 `/items` endpoint with `itemType=Report` and `itemType=Category`
- **Processing**: Backend groups flat API response by `CategoryName` into tree structure
- **Frontend**: `reportsAPI.getReportTree()` → `useData().getReports()`
- **Verification**: Search for `DEFAULT_CATEGORIES` or `HARDCODED_REPORTS` = NO RESULTS

### ✅ Schedules
- **Status**: FULLY API-DRIVEN
- **Source**: Bold Reports v5.0 `/reports/schedule/items` endpoint
- **Removed**: `DEFAULT_SCHEDULES` constant (previously had 4 hardcoded schedules)
- **Frontend**: `schedulesAPI.getSchedules()` → `useData().getSchedules()`
- **Verification**: File `Schedules.jsx` line 69: "// No hardcoded defaults - the component will fetch from the backend"

### ✅ Dashboards
- **Status**: FULLY API-DRIVEN
- **Source**: Bold BI REST API
- **Frontend**: `dashboardsAPI.getList()` → `useData().getDashboards()`
- **Verification**: No `DEFAULT_DASHBOARDS` found in codebase

### ✅ Users
- **Status**: FULLY API-DRIVEN
- **Source**: Bold Reports user management API
- **Frontend**: `usersAPI.getUsers()` → `useData().getUsers()`
- **Verification**: No hardcoded user lists in components

### ✅ Reports in Schedules Modal
- **Status**: FULLY API-DRIVEN
- **Source**: `getReports()` from context (which fetches from Bold Reports API)
- **Processing**: 
  1. Backend fetches reports from API
  2. Groups by category
  3. Frontend receives categories and reports
  4. Modal populates dropdowns from fetched data
- **Verification**: ScheduleModal receives `categories` and `reportsByCategory` from parent component state (set from API data)

## API Caching Strategy

**DataContext.jsx** implements intelligent caching:
- **TTL**: 60 seconds for in-memory cache
- **Behavior**: Returns cached data if available and not stale
- **Manual Invalidation**: `invalidate(dataType)` forces fresh fetch
- **Benefit**: Reduces API load while maintaining data freshness

## Error Handling

**All API calls include error handling**:
- 401 Unauthorized: Redirects to login
- Network errors: Logged to console, fallback to empty arrays
- Invalid responses: Logged and handled gracefully

## Production Ready

✅ No hardcoded defaults (Schedules, Reports)
✅ Real-time data from API
✅ Proper error handling
✅ Smart caching
✅ User authentication enforced
✅ Role-based access control (RLS) via Bold Reports

## Recent Changes

**Removed Hardcoded Data:**
1. ✅ Removed `DEFAULT_REPORT_TREE` from `Reports.jsx` (7 reports)
2. ✅ Removed `DEFAULT_SCHEDULES` from `Schedules.jsx` (4 schedules, completed in prior changes)
3. ✅ Changed fallback behavior from hardcoded data to empty arrays

**Files Modified:**
- `boldadhocembed.client/src/pages/Reports.jsx`: Lines 102-127 (removed DEFAULT_REPORT_TREE)
- `boldadhocembed.client/src/pages/Reports.jsx`: Lines 283, 287 (changed to empty array fallback)

## How to Verify

### 1. Check for Hardcoded Data
```bash
# Search for any remaining hardcoded defaults
grep -r "DEFAULT_" boldadhocembed.client/src/pages/
grep -r "HARDCODED" boldadhocembed.client/src/
grep -r "const.*Reports.*=" boldadhocembed.client/src/pages/
```

### 2. Test API Integration
1. Start application: `docker-compose down && docker-compose up -d --build`
2. Navigate to Reports page - should show categories/reports from Bold Reports API
3. Navigate to Schedules page - should show schedules from API
4. If no data available, tables should display empty state (not show hardcoded data)

### 3. Verify Data Sources
- **Reports**: Check browser Network tab → `/api/reports/tree` should return API data
- **Schedules**: Check Network tab → `/api/schedules` should return API data
- **Categories**: Derived from reports' `CategoryName` field from API

## Testing Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| API is up, has data | All categories, reports, schedules display correctly |
| API is up, no data | Empty lists shown, no error |
| API is down | Empty lists shown, error in console |
| User has no access | Empty lists (RLS enforced server-side) |
| Create new schedule | Appears in list after API call succeeds |
| Delete schedule | Removed from list after API call succeeds |
