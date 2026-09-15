# Users and Tenant Details

## Application System Users (In-Memory Store)

These users are configured in the `InMemoryUserStore` for the BoldAdhocEmbed application login system.

### 1. **Manoranjan Rajendran** (Admin)
- **Email**: `manoranjan.rajendran@syncfusion.com`
- **Name**: Manoranjan Rajendran
- **Role**: Admin
- **Tenant ID**: 1
- **Tenant Name**: Default
- **Region**: US
- **Status**: Active
- **Permissions**: Full access (View, Edit, Delete, Create, Export, Schedule, Manage Users, View Audit Logs)
- **Password**: `admin123`

### 2. **Admin User**
- **Email**: `admin@example.com`
- **Name**: Admin User
- **Role**: Admin
- **Tenant ID**: 1
- **Tenant Name**: Default
- **Region**: US
- **Status**: Active
- **Permissions**: Full access (View, Edit, Delete, Create, Export, Schedule, Manage Users, View Audit Logs)
- **Password**: `admin123`

### 3. **Sales User**
- **Email**: `sales@example.com`
- **Name**: Sales User
- **Role**: Sales
- **Tenant ID**: 1
- **Tenant Name**: Default
- **Region**: US
- **Status**: Active
- **Permissions**: View, Export (Read-only access)
- **Password**: `sales123`

### 4. **Manager User**
- **Email**: `manager@example.com`
- **Name**: Manager User
- **Role**: Manager
- **Tenant ID**: 1
- **Tenant Name**: Default
- **Region**: US
- **Status**: Active
- **Permissions**: View, Edit, Create, Export, Schedule, View Audit Logs (Manager-level access)
- **Password**: `manager123`

---

## Tenant Information

### Application Tenants (In-Memory Store)
| Tenant ID | Tenant Name | Users Count | Region | Purpose |
|-----------|------------|-------------|--------|---------|
| 1 | Default | 4 | US | Primary application tenant |

### CRM Database Tenants (PostgreSQL Multi-Tenant)
| Tenant Name | Database | Users Count | Region | Purpose |
|------------|----------|-------------|--------|---------|
| Alpha Corp | crm_alphacorp | 5 | Multi-region | CRM for Alpha Corporation |
| Beta Solutions | crm_betasolutions | 5 | Multi-region | CRM for Beta Solutions |
| Delta Enterprises | crm_deltaenterprises | 5 | Multi-region | CRM for Delta Enterprises |
| Gamma Industries | crm_gammaindustries | 5 | Multi-region | CRM for Gamma Industries |

**Total Tenants**: 5 (1 app + 4 CRM)  
**Total Users**: 24 (4 app + 20 CRM)

---

## CRM Database Users (Multi-Tenant)

The following users are configured in the PostgreSQL database for each tenant:

### 1. AlphaCorp Tenant Users

| # | Email | Name | Role | Region | Status |
|---|-------|------|------|--------|--------|
| 1 | `alpha1@alphacorp.com` | Anna Smith | Admin | North America | Active |
| 2 | `alpha2@alphacorp.com` | John Doe | Sales | Europe | Active |
| 3 | `alpha3@alphacorp.com` | Linda Lee | Finance | Asia | Active |
| 4 | `alpha4@alphacorp.com` | Mike Brown | Support | Oceania | Active |
| 5 | `alpha5@alphacorp.com` | Chris Green | Operations | Oceania | Active |

**Database**: `crm_alphacorp`  
**Total Users**: 5

---

### 2. Beta Solutions Tenant Users

| # | Email | Name | Role | Region | Status |
|---|-------|------|------|--------|--------|
| 1 | `beta1@betasolutions.com` | Betty Jones | Admin | North America | Active |
| 2 | `beta2@betasolutions.com` | Julia King | Sales | Europe | Active |
| 3 | `beta3@betasolutions.com` | Brian Adams | Finance | Asia | Active |
| 4 | `beta4@betasolutions.com` | Diana Miller | Support | Oceania | Active |
| 5 | `beta5@betasolutions.com` | Eliza Scott | Operations | Oceania | Active |

**Database**: `crm_betasolutions`  
**Total Users**: 5

---

### 3. Delta Enterprises Tenant Users

| # | Email | Name | Role | Region | Status |
|---|-------|------|------|--------|--------|
| 1 | `delta1@deltaenterprises.com` | Megan Young | Admin | North America | Active |
| 2 | `delta2@deltaenterprises.com` | Zoe Turner | Sales | Europe | Active |
| 3 | `delta3@deltaenterprises.com` | Ryan Evans | Finance | Asia | Active |
| 4 | `delta4@deltaenterprises.com` | Liam Cooper | Support | Oceania | Active |
| 5 | `delta5@deltaenterprises.com` | Emma Hall | Operations | Oceania | Active |

**Database**: `crm_deltaenterprises`  
**Total Users**: 5

---

### 4. Gamma Industries Tenant Users

| # | Email | Name | Role | Region | Status |
|---|-------|------|------|--------|--------|
| 1 | `gamma1@gammaindustries.com` | George William | Admin | North America | Active |
| 2 | `gamma2@gammaindustries.com` | Jack Black | Sales | Europe | Active |
| 3 | `gamma3@gammaindustries.com` | Olivia Martin | Finance | Asia | Active |
| 4 | `gamma4@gammaindustries.com` | Sophia White | Support | Oceania | Active |
| 5 | `gamma5@gammaindustries.com` | Noah Clark | Operations | Oceania | Active |

**Database**: `crm_gammaindustries`  
**Total Users**: 5

---

### Multi-Tenant Architecture
- Each tenant has its own **isolated PostgreSQL database**
- Users are region-based (North America, Europe, Asia, Oceania)
- Standard roles across all tenants: Admin, Sales, Finance, Support, Operations
- Each tenant database follows the same schema: `crm_schema.sql`
- **Total CRM Database Users**: 20 (5 per tenant × 4 tenants)

---

## User Authentication & Storage

### Authentication Flow
1. **In-Memory Store** (Primary): Used for application login and RBAC
   - Configured in `IUserStore.cs`
   - Used by `AuthController.cs`

2. **Database Store** (Optional): PostgreSQL multi-tenant database
   - Tables: `users` table in tenant-specific databases
   - Schema: `crm_schema.sql`
   - Connection: Region-based routing

### Default Tenant Information
- **Tenant ID**: 1
- **Tenant Name**: Default
- **Region**: US
- **Purpose**: Primary application tenant

---

## User Model Properties

```
AppUser
├── Id (Unique identifier)
├── Email (Unique, used for login)
├── Name (Full name)
├── FirstName
├── LastName
├── PasswordHash
├── Role (Admin, Manager, Sales, Support, Finance, Operations)
├── TenantId
├── TenantName
├── Region
├── AvatarUrl
├── IsActive
├── Permissions (PermissionSet object)
├── CreatedDate
└── LastLoginDate
```

---

## Role-Based Permissions

### Admin Role
- ✅ View
- ✅ Edit
- ✅ Delete
- ✅ Create
- ✅ Export
- ✅ Schedule
- ✅ Manage Users
- ✅ View Audit Logs

### Manager Role
- ✅ View
- ✅ Edit
- ✅ Create
- ✅ Export
- ✅ Schedule
- ✅ View Audit Logs
- ❌ Delete
- ❌ Manage Users

### Sales Role
- ✅ View
- ✅ Export
- ❌ Edit
- ❌ Delete
- ❌ Create
- ❌ Schedule
- ❌ Manage Users
- ❌ View Audit Logs

---

## API Endpoints for User Management

### Get All Users
```
GET /api/users/getusers
Authorization: Bearer {token}
```

### Get Users by Tenant
```
GET /api/users/getbytenant?tenantId={tenantId}
Authorization: Bearer {token}
```

### User Authentication
```
POST /api/auth/login
Content-Type: application/json
{
  "email": "manoranjan.rajendran@syncfusion.com",
  "password": "admin123"
}
```

---

## Summary

| Metric | Count |
|--------|-------|
| **Application Tenants** | 1 |
| **CRM Database Tenants** | 4 |
| **Total Tenants** | 5 |
| **Application Users** | 4 |
| **CRM Database Users** | 20 |
| **Total Users** | 24 |
| **Primary Admin** | manoranjan.rajendran@syncfusion.com |
| **Regions Covered** | North America, Europe, Asia, Oceania |
| **Standard User Roles** | Admin, Sales, Finance, Support, Operations |

### User Distribution by Tenant

**Application (Default Tenant)**
- Admin: 2 users
- Sales: 1 user
- Manager: 1 user
- Total: 4 users

**Each CRM Tenant (Alpha, Beta, Delta, Gamma)**
- Admin: 1 user
- Sales: 1 user
- Finance: 1 user
- Support: 1 user
- Operations: 1 user
- Total: 5 users per tenant

---

**Last Updated**: 2026-09-08  
**Source Files**:
- `BoldAdhocEmbed.Server/Services/IUserStore.cs`
- `BoldAdhocEmbed.Server/Models/AppUser.cs`
- `sql/crm_schema.sql`
- `sql/crm_alphacorp_seed.sql`
