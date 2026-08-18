# 🧠 AI App Builder Prompt: Enterprise CRM Application with Reports, Dashboard & Scheduler 

> **How to use this file:** Copy everything below the "PROMPT START" line into your AI UI/layout builder tool as the prompt.

---
---

## PROMPT START — PASTE EVERYTHING BELOW INTO YOUR AI BUILDER

---

# Build a Complete Enterprise CRM Web Application

## 🎯 Application Overview

I want a **fully-featured, enterprise-grade CRM (Customer Relationship Management) web application** called **"BDS CRM Suite"**. This application is used by **4 enterprise companies (tenants)** who log in with their own credentials. Each tenant's data is isolated using **Row-Level Security (RLS)** and **Role-Based Access Control (RBAC)**.

The application is a **multi-tenant SaaS CRM** with the following core feature areas:

Home areas is a main then others are below,

1. **Dashboard** — Visual KPIs and charts powered by embedded Bold BI
2. **Reports** — Tabular, paginated, and exportable reports powered by Bold Reports
3. **Scheduler** — Automated report delivery and scheduling
4. **Contacts** — CRM contact/lead management
5. **Deals** — Sales pipeline management
6. **Activities** — Call logs, meetings, demos, follow-ups
7. **Support Tickets** — Customer support case management
8. **Invoices** — Billing and payment tracking
9. **Campaigns** — Marketing campaign management
10. **Tasks** — User task manager
11. **Audit Log** — System audit trail

---

## 🏢 Multi-Tenant Architecture

There are exactly **4 companies (tenants)**, each using the same application but seeing only their own data:

| # | Company Name | Database Name | Tenant ID | Domain |
|---|---|---|---|---|
| 1 | **AlphaCorp** | `crm_alphacorp` | 1 | @alphacorp.com |
| 2 | **BetaSolutions** | `crm_betasolutions` | 2 | @betasolutions.com |
| 3 | **GammaIndustries** | `crm_gammaindustries` | 3 | @gammaindustries.com |
| 4 | **DeltaEnterprises** | `crm_deltaenterprises` | 4 | @deltaenterprises.com |

Each tenant gets their **own PostgreSQL database** (same schema, different data). The app connects to the correct database based on the logged-in user's `tenantId` JWT claim.

---

## 👥 Users & Roles (RBAC — Role-Based Access Control)

Each company has exactly **5 users** with different roles. Each role has distinct permissions:

### Roles & Permissions Matrix

| Role | View | Create | Edit | Delete | Reports | Dashboard | Schedule | Admin Panel |
|---|---|---|---|---|---|---|---|---|
| **Admin** | ✅ All | ✅ | ✅ | ✅ | ✅ All | ✅ All | ✅ | ✅ |
| **Sales** | ✅ Own region | ✅ | ✅ | ❌ | ✅ Sales reports | ✅ Sales KPIs | ❌ | ❌ |
| **Finance** | ✅ Own region | ❌ | ❌ | ✅ | ✅ Financial reports | ✅ Finance KPIs | ❌ | ❌ |
| **Support** | ✅ Own region | ✅ | ✅ | ❌ | ✅ Support reports | ✅ Support KPIs | ❌ | ❌ |
| **Operations** | ✅ Own region | ✅ | ✅ | ❌ | ✅ Ops reports | ✅ Ops KPIs | ❌ | ❌ |

### Users Per Tenant

**AlphaCorp (Tenant 1)**
- `alpha1@alphacorp.com` — Anna Smith — **Admin** — North America
- `alpha2@alphacorp.com` — John Doe — **Sales** — Europe
- `alpha3@alphacorp.com` — Linda Lee — **Finance** — Asia
- `alpha4@alphacorp.com` — Mike Brown — **Support** — Oceania
- `alpha5@alphacorp.com` — Chris Green — **Operations** — Oceania

**BetaSolutions (Tenant 2)**
- `beta1@betasolutions.com` — Betty Jones — **Admin** — North America
- `beta2@betasolutions.com` — Julia King — **Sales** — Europe
- `beta3@betasolutions.com` — Brian Adams — **Finance** — Asia
- `beta4@betasolutions.com` — Diana Miller — **Support** — Oceania
- `beta5@betasolutions.com` — Eliza Scott — **Operations** — Oceania

**GammaIndustries (Tenant 3)**
- `gamma1@gammaindustries.com` — George William — **Admin** — North America
- `gamma2@gammaindustries.com` — Jack Black — **Sales** — Europe
- `gamma3@gammaindustries.com` — Olivia Martin — **Finance** — Asia
- `gamma4@gammaindustries.com` — Sophia White — **Support** — Oceania
- `gamma5@gammaindustries.com` — Noah Clark — **Operations** — Oceania

**DeltaEnterprises (Tenant 4)**
- `delta1@deltaenterprises.com` — Megan Young — **Admin** — North America
- `delta2@deltaenterprises.com` — Zoe Turner — **Sales** — Europe
- `delta3@deltaenterprises.com` — Ryan Evans — **Finance** — Asia
- `delta4@deltaenterprises.com` — Liam Cooper — **Support** — Oceania
- `delta5@deltaenterprises.com` — Emma Hall — **Operations** — Oceania

---

## 🔐 Row-Level Security (RLS)

**RLS is applied at the PostgreSQL database level** using a session variable:

```sql
-- For non-admin: only see rows from their region
BEGIN;
SET LOCAL app.current_region = 'Europe';
SELECT * FROM contacts;  -- returns only European contacts
COMMIT;

-- For Admin: sees all data across all regions
BEGIN;
SET LOCAL app.current_region = 'ALL';
SELECT * FROM contacts;  -- returns all 260 contacts
COMMIT;
```

### RLS Behavior
- **Admin role**: `app.current_region = 'ALL'` → sees everything
- **Non-admin roles**: `app.current_region = '{user_region}'` → only own region
- **Enforced on 10 tables** (all tables with a `region` column)
- **Tables WITHOUT RLS**: `users`, `products`, `deal_products`, `campaign_contacts`

### JWT Claims
```json
{
  "email": "alpha2@alphacorp.com",
  "role": "Sales",
  "tenantId": 1,
  "tenantName": "AlphaCorp",
  "region": "Europe",
  "name": "John Doe"
}
```

---

## 🗄️ Complete Database Schema — All 14 Tables

**Connection:**
- Host: `localhost` | Port: `5434` | User: `postgres` | Password: `Password123!`
- Databases: `crm_alphacorp`, `crm_betasolutions`, `crm_gammaindustries`, `crm_deltaenterprises`
- Data range: **August 2025 – July 2026** (12 months pre-seeded)

---

### Table 1: `users`
| Column | Type | Notes |
|---|---|---|
| `user_id` | SERIAL PK | |
| `email` | VARCHAR(255) UNIQUE | Login identity |
| `name` | VARCHAR(255) | Full name |
| `role` | VARCHAR(50) | Admin/Sales/Finance/Support/Operations |
| `region` | VARCHAR(100) | North America/Europe/Asia/Oceania |
| `avatar_url` | TEXT | Profile picture |
| `is_active` | BOOLEAN | Account status |
| `created_at` | TIMESTAMPTZ | |

---

### Table 2: `contacts` *(RLS enabled)*
| Column | Type | Notes |
|---|---|---|
| `contact_id` | SERIAL PK | |
| `first_name` | VARCHAR(100) | |
| `last_name` | VARCHAR(100) | |
| `email` | VARCHAR(255) | Contact email |
| `phone` | VARCHAR(50) | |
| `company` | VARCHAR(255) | Organization name |
| `job_title` | VARCHAR(150) | |
| `region` | VARCHAR(100) | **RLS filter column** |
| `lead_source` | VARCHAR(100) | Website/LinkedIn/Referral/Cold Email/Webinar/Conference |
| `status` | VARCHAR(50) | Active/Inactive/Churned |
| `owner_email` | VARCHAR FK→users | Assigned sales rep |
| `created_at` | TIMESTAMPTZ | |

---

### Table 3: `products`
| Column | Type | Notes |
|---|---|---|
| `product_id` | SERIAL PK | |
| `product_name` | VARCHAR(255) | e.g. "Enterprise CRM License (Annual)" |
| `category` | VARCHAR(100) | Software/Hardware/Services/Support |
| `unit_price` | NUMERIC(15,2) | Base price in USD |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

**15 products seeded** ($3,200–$24,000 range)

---

### Table 4: `deals` *(RLS enabled)*
| Column | Type | Notes |
|---|---|---|
| `deal_id` | SERIAL PK | |
| `deal_name` | VARCHAR(255) | Description of the opportunity |
| `contact_id` | INT FK→contacts | Associated customer |
| `owner_email` | VARCHAR FK→users | Owning sales rep |
| `stage` | VARCHAR(50) | Prospecting/Qualification/Proposal/Negotiation/Closed Won/Closed Lost |
| `amount` | NUMERIC(15,2) | Deal value ($8,000–$220,000 range) |
| `currency` | VARCHAR(3) | USD |
| `probability` | INT | 0–100% win probability |
| `region` | VARCHAR(100) | **RLS filter column** |
| `expected_close_date` | DATE | |
| `actual_close_date` | DATE | NULL if still open |
| `created_at` | TIMESTAMPTZ | |

---

### Table 5: `deal_products`
| Column | Type | Notes |
|---|---|---|
| `deal_product_id` | SERIAL PK | |
| `deal_id` | INT FK→deals | Parent deal |
| `product_id` | INT FK→products | Product sold |
| `quantity` | INT | Units (1–5) |
| `unit_price` | NUMERIC(15,2) | Price at time of deal |
| `discount_pct` | NUMERIC(5,2) | 0/5/10/15% discount |
| `total_price` | NUMERIC(15,2) | qty × price × (1 - discount) |

---

### Table 6: `activities` *(RLS enabled)*
| Column | Type | Notes |
|---|---|---|
| `activity_id` | SERIAL PK | |
| `activity_type` | VARCHAR(50) | Call/Email/Meeting/Demo/Follow-up |
| `subject` | VARCHAR(255) | Activity title |
| `description` | TEXT | Detailed notes |
| `contact_id` | INT FK→contacts | |
| `deal_id` | INT FK→deals | Nullable |
| `owner_email` | VARCHAR FK→users | User who logged it |
| `region` | VARCHAR(100) | **RLS filter column** |
| `activity_date` | TIMESTAMPTZ | When it happened |
| `duration_minutes` | INT | 15/30/45/60/90 |
| `outcome` | VARCHAR(100) | Completed/Follow-up Needed/Rescheduled/Positive Interest/Action Items Assigned |
| `created_at` | TIMESTAMPTZ | |

---

### Table 7: `invoices` *(RLS enabled)*
| Column | Type | Notes |
|---|---|---|
| `invoice_id` | SERIAL PK | |
| `invoice_number` | VARCHAR(50) UNIQUE | INV-2025-0001 format |
| `contact_id` | INT FK→contacts | Billed to |
| `deal_id` | INT FK→deals | Source deal |
| `amount` | NUMERIC(15,2) | Net amount |
| `tax_amount` | NUMERIC(15,2) | 8% tax |
| `total_amount` | NUMERIC(15,2) | amount + tax |
| `currency` | VARCHAR(3) | USD |
| `status` | VARCHAR(50) | Draft/Sent/Paid/Overdue/Cancelled |
| `region` | VARCHAR(100) | **RLS filter column** |
| `issued_date` | DATE | |
| `due_date` | DATE | 30-day net terms |
| `paid_date` | DATE | NULL if unpaid |
| `created_by` | VARCHAR FK→users | Finance user |
| `created_at` | TIMESTAMPTZ | |

---

### Table 8: `revenue_summary` *(RLS enabled)*
Pre-aggregated monthly KPIs — one row per month per region

| Column | Type | Notes |
|---|---|---|
| `revenue_id` | SERIAL PK | |
| `month` | DATE | First day of month (Aug 2025–Jul 2026) |
| `region` | VARCHAR(100) | **RLS filter column** |
| `total_revenue` | NUMERIC(15,2) | Closed Won revenue for month |
| `total_deals_won` | INT | Won deal count |
| `total_deals_lost` | INT | Lost deal count |
| `avg_deal_size` | NUMERIC(15,2) | Average value of won deals |
| `new_contacts` | INT | New contacts added |

**48 rows total** (12 months × 4 regions)

---

### Table 9: `support_tickets` *(RLS enabled)*
| Column | Type | Notes |
|---|---|---|
| `ticket_id` | SERIAL PK | |
| `ticket_number` | VARCHAR(50) UNIQUE | TKT-2025-0001 format |
| `subject` | VARCHAR(255) | Issue title |
| `description` | TEXT | Details |
| `contact_id` | INT FK→contacts | Customer who raised it |
| `priority` | VARCHAR(20) | Low/Medium/High/Critical |
| `status` | VARCHAR(50) | Open/In Progress/Resolved/Closed/Escalated |
| `category` | VARCHAR(100) | Billing/Technical/Feature Request/Bug/General |
| `assigned_to` | VARCHAR FK→users | Support agent |
| `region` | VARCHAR(100) | **RLS filter column** |
| `created_at` | TIMESTAMPTZ | |
| `resolved_at` | TIMESTAMPTZ | NULL if still open |
| `satisfaction_score` | INT | CSAT 1–5 (NULL if not rated) |

---

### Table 10: `campaigns` *(RLS enabled)*
| Column | Type | Notes |
|---|---|---|
| `campaign_id` | SERIAL PK | |
| `campaign_name` | VARCHAR(255) | |
| `campaign_type` | VARCHAR(100) | Email/Webinar/Trade Show/Social Media/Content |
| `status` | VARCHAR(50) | Planned/Active/Completed/Cancelled |
| `budget` | NUMERIC(15,2) | Approved budget USD |
| `actual_cost` | NUMERIC(15,2) | Actual spend |
| `start_date` | DATE | |
| `end_date` | DATE | |
| `region` | VARCHAR(100) | **RLS filter column** |
| `owner_email` | VARCHAR FK→users | Campaign manager |
| `leads_generated` | INT | Attributed leads |
| `created_at` | TIMESTAMPTZ | |

---

### Table 11: `campaign_contacts`
Junction table: contacts enrolled in campaigns

| Column | Type | Notes |
|---|---|---|
| `campaign_contact_id` | SERIAL PK | |
| `campaign_id` | INT FK→campaigns | |
| `contact_id` | INT FK→contacts | |
| `responded` | BOOLEAN | |
| `response_date` | DATE | NULL if not responded |

---

### Table 12: `tasks` *(RLS enabled)*
| Column | Type | Notes |
|---|---|---|
| `task_id` | SERIAL PK | |
| `title` | VARCHAR(255) | Task description |
| `description` | TEXT | |
| `assigned_to` | VARCHAR FK→users | |
| `related_contact_id` | INT FK→contacts | Nullable |
| `related_deal_id` | INT FK→deals | Nullable |
| `priority` | VARCHAR(20) | Low/Medium/High/Urgent |
| `status` | VARCHAR(50) | Pending/In Progress/Completed/Cancelled |
| `due_date` | DATE | |
| `region` | VARCHAR(100) | **RLS filter column** |
| `completed_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |

---

### Table 13: `audit_log` *(RLS enabled)*
| Column | Type | Notes |
|---|---|---|
| `log_id` | SERIAL PK | |
| `table_name` | VARCHAR(100) | Affected table |
| `record_id` | INT | Affected record ID |
| `action` | VARCHAR(20) | INSERT/UPDATE/DELETE |
| `performed_by` | VARCHAR(255) | User email |
| `region` | VARCHAR(100) | **RLS filter column** |
| `details` | JSONB | Changed fields as JSON |
| `performed_at` | TIMESTAMPTZ | |

---

### Table 14: `email_logs` *(RLS enabled)*
| Column | Type | Notes |
|---|---|---|
| `email_log_id` | SERIAL PK | |
| `from_email` | VARCHAR(255) | CRM user who sent it |
| `to_email` | VARCHAR(255) | Contact's email |
| `subject` | VARCHAR(255) | Email subject |
| `body_preview` | TEXT | First lines of body |
| `contact_id` | INT FK→contacts | |
| `deal_id` | INT FK→deals | Nullable |
| `region` | VARCHAR(100) | **RLS filter column** |
| `sent_at` | TIMESTAMPTZ | |
| `status` | VARCHAR(50) | Sent/Delivered/Opened/Bounced |

---

## 📊 SECTION 1: Dashboard Module (Embedded Bold BI)

The Dashboard section embeds Bold BI dashboards that auto-filter to the user's region via RLS.

**Bold BI Embed Config:**
```
Embed URL:      https://cloud.boldbi.com/bi
Site Identifier: b1159702
Embed Secret:   nhXoWeoMdDfCkSFD3AxiriqPLreL9VJe
Admin User:     manoranjan.rajendran@syncfusion.com
```

### 5 Role-Specific Dashboards

**1. Executive Dashboard (Admin)**
- Total Revenue KPI card (from `revenue_summary.total_revenue` sum 12 months)
- Revenue trend line chart (12 months × region from `revenue_summary`)
- Deals by stage funnel (from `deals`)
- New contacts per month bar chart (from `contacts.created_at`)
- Top 5 deals by amount table (from `deals WHERE stage = 'Closed Won'`)
- Avg support resolution time KPI (from `support_tickets`)
- Campaign ROI: leads_generated / budget (from `campaigns`)
- Win/loss ratio by region donut (from `revenue_summary`)

**2. Sales Dashboard**
- My pipeline by stage kanban/funnel (from `deals` filtered by `owner_email`)
- Monthly deals closed bar chart (from `deals WHERE stage = 'Closed Won'`)
- Activity log this week timeline (from `activities`)
- Top contacts by deal value table
- Quota attainment KPI card
- Campaign leads in pipeline

**3. Finance Dashboard**
- Total invoiced vs collected KPI cards (from `invoices`)
- Overdue invoices count & value red alert (from `invoices WHERE status='Overdue'`)
- Monthly revenue bar chart (from `revenue_summary`)
- Invoice status donut chart (Paid/Sent/Overdue breakdown)
- Average deal size trend line (from `revenue_summary.avg_deal_size`)
- Tax collected by month

**4. Support Dashboard**
- Open tickets by priority stacked bar (Low/Medium/High/Critical)
- Average resolution time in hours KPI
- CSAT score trend line (from `support_tickets.satisfaction_score`)
- Tickets by category donut
- Escalated tickets alert list
- Tickets resolved this week KPI

**5. Operations Dashboard**
- Active campaigns table with ROI (from `campaigns`)
- Campaign response rate % (from `campaign_contacts`)
- Tasks by status kanban (from `tasks`)
- Overdue tasks alert list
- Recent audit actions (from `audit_log`)
- Email delivery success rate pie (from `email_logs`)

---

## 📋 SECTION 2: Reports Module (Embedded Bold Reports)

The Reports section embeds Bold Reports with export to PDF, Excel, CSV.

**Bold Reports Embed Config:**
```
Root URL:        https://cloud.boldreports.com/reporting
Site Identifier: b1159702
Embed Secret:    Yhfw5o9c01TVdPk8HWhQQnGKAl0K9HP
Admin User:      manoranjan.rajendran@syncfusion.com
```

**RLS Report Parameters:**
- `@region` → user's region (or 'ALL' for Admin)
- `@tenantId` → user's tenant ID

### Reports by Category

**Sales Reports**
| Report | Source Tables |
|---|---|
| Sales Pipeline Summary | `deals` grouped by stage |
| Monthly Deals Won/Lost | `deals` + `revenue_summary` |
| Deal Aging Report | Open `deals` sorted by age |
| Activity Log Report | `activities` all types/outcomes |
| Contact List Report | `contacts` with lead_source and status |
| Sales Rep Performance | `deals JOIN users` per rep |
| Product Sales Breakdown | `deal_products JOIN products` |

**Finance Reports**
| Report | Source Tables |
|---|---|
| Invoice Aging Report | `invoices` grouped 0-30/31-60/60+ days |
| Monthly Revenue Report | `revenue_summary` all columns |
| Paid vs Outstanding | `invoices` grouped by status |
| Tax Summary Report | `invoices.tax_amount` by month |
| Invoice Detail Report | `invoices JOIN contacts` |
| Annual Revenue Forecast | Open pipeline deals |

**Support Reports**
| Report | Source Tables |
|---|---|
| Ticket Summary Report | `support_tickets` by status/priority |
| CSAT Analysis Report | `support_tickets.satisfaction_score` |
| Agent Performance Report | `support_tickets JOIN users` |
| Escalated Tickets Report | `support_tickets WHERE status='Escalated'` |
| SLA Compliance Report | Resolution time vs priority SLA |

**Operations Reports**
| Report | Source Tables |
|---|---|
| Campaign Performance Report | `campaigns JOIN campaign_contacts` |
| Email Deliverability Report | `email_logs` status breakdown |
| Task Completion Report | `tasks JOIN users` |
| Audit Trail Report | `audit_log` full history |

---

## ⏰ SECTION 3: Scheduler Module

The Scheduler automates report delivery via email.

### Schedule List View
Table with: Report Name | Recipient(s) | Frequency | Next Run | Last Run | Status (Active/Paused)
- Inline enable/disable toggle
- Edit and Delete buttons

### Create/Edit Schedule Form
- **Report**: Dropdown of available reports
- **Schedule Name**: Free text label
- **Recipients**: Multi-select (tenant users only)
- **Frequency**: Once / Daily / Weekly / Monthly
- **Time**: Time picker (HH:MM)
- **Day** (for Weekly): Checkbox multi-select
- **Date** (for Once/Monthly): Date picker
- **Export Format**: PDF / Excel / CSV
- **Email Subject**: Template text
- **Message Body**: Rich text editor
- **Status**: Active / Paused

### Execution History Log
Table: Schedule Name | Report | Sent To | Sent At | Status (Sent/Failed/Pending)
- Date range filter
- Retry failed deliveries button

---

## 🧭 Navigation & Layout

### Left Sidebar (collapsible)
```
🏠 Home / Overview
📊 Dashboard
   ├── Executive (Admin only)
   ├── Sales
   ├── Finance
   ├── Support
   └── Operations
📋 Reports
   ├── Sales Reports
   ├── Finance Reports
   ├── Support Reports
   └── Operations Reports
⏰ Scheduler
   ├── Scheduled Reports
   └── Execution History
👥 Contacts
💼 Deals (Pipeline)
📞 Activities
🎫 Support Tickets
💳 Invoices
📣 Campaigns
✅ Tasks
🔍 Audit Log (Admin only)
⚙️ Admin Panel (Admin only)
   ├── Manage Users
   ├── Manage Products
   └── Settings
```

### Top Header
- Company logo (left) + Tenant name badge
- Notifications bell icon
- User avatar + name + role badge (right)
- Logout button

### Role-Based Menu Visibility
- **Admin**: All items
- **Sales**: Dashboard(Sales), Reports(Sales), Contacts, Deals, Activities, Tasks
- **Finance**: Dashboard(Finance), Reports(Finance), Invoices
- **Support**: Dashboard(Support), Reports(Support), Contacts, Support Tickets, Tasks
- **Operations**: Dashboard(Ops), Reports(Ops), Campaigns, Tasks, Email Logs

---

## 🎨 UI Design Guidelines

- **Brand Color**: `#6c5ce7` (purple)
- **Accent**: `#10b981` (emerald green)
- **Error**: `#ef4444` (red)
- **Font**: Inter, system-ui, Segoe UI
- **Style**: Glassmorphism cards, subtle shadows, dark/light mode toggle
- **Animations**: Fade-in on load, hover lift on cards, skeleton loaders for async data
- **KPI Cards**: Large metric number + label + trend arrow (% vs last month)
- **Tables**: Sortable, filterable, paginated (25/page), row hover highlight
- **Role Badge colors**: Admin=purple, Sales=blue, Finance=green, Support=orange, Operations=teal
- **Region Badge**: Always visible in header showing current user's region
- **Toast Notifications**: Bottom-right, auto-dismiss after 4s
- **Pipeline**: Drag-and-drop Kanban board with deal cards by stage column

---

## 🔗 Required API Endpoints

```
Authentication:
POST /api/auth/login       → Validate credentials, return JWT

Contacts (RLS via region):
GET    /api/contacts        → List (paginated, filterable)
POST   /api/contacts        → Create
PUT    /api/contacts/:id    → Update
DELETE /api/contacts/:id    → Delete (Admin/Finance only)

Deals:
GET    /api/deals           → List with stage filter
POST   /api/deals           → Create
PUT    /api/deals/:id       → Update stage/amount
DELETE /api/deals/:id       → Delete (Admin only)

Activities:
GET    /api/activities      → List with contact_id/type filter
POST   /api/activities      → Log activity

Invoices:
GET    /api/invoices        → List with status filter
POST   /api/invoices        → Create (Finance/Admin)
PUT    /api/invoices/:id    → Update status

Support Tickets:
GET    /api/tickets         → List with priority/status filter
POST   /api/tickets         → Create
PUT    /api/tickets/:id     → Update status/assignment

Campaigns:
GET    /api/campaigns       → List
POST   /api/campaigns       → Create
PUT    /api/campaigns/:id   → Update

Tasks:
GET    /api/tasks           → List with assigned_to/status filter
POST   /api/tasks           → Create
PUT    /api/tasks/:id       → Update status

KPIs & Charts (from revenue_summary):
GET    /api/revenue-summary → Monthly KPIs by region

Audit Log (Admin only):
GET    /api/audit-log       → List with table/date filter

Report Scheduler:
GET    /api/schedules          → List tenant schedules
POST   /api/schedules          → Create schedule
PUT    /api/schedules/:id      → Update schedule
DELETE /api/schedules/:id      → Delete schedule
GET    /api/schedules/history  → Execution history log
```

---

## ✅ Build Checklist (What to Create)

1. **Login page** — dropdown of users grouped by tenant, JWT authentication
2. **Left sidebar** — role-aware navigation (hide/show by role)
3. **Dashboard section** — 5 role-specific embedded Bold BI dashboards + KPI cards
4. **Reports section** — categorized report list with embedded Bold Reports viewer and PDF/Excel/CSV export
5. **Scheduler section** — create/edit/delete report schedules + execution history
6. **Contacts module** — CRUD grid, search, filter by region/status/lead_source
7. **Deals module** — Kanban pipeline + list view, create/edit/link products
8. **Activities module** — log calls/emails/meetings, filter by type/outcome/date
9. **Support Tickets module** — grid + detail, CSAT tracking, assignment
10. **Invoices module** — invoice list, payment status, aging view
11. **Campaigns module** — campaign list, metrics, contact enrollment
12. **Tasks module** — My tasks + team tasks, priority and due date management
13. **Audit Log module** — read-only timeline (Admin only)
14. **Admin Panel** — user management, product catalog, system settings

**Non-negotiable requirements:**
- ✅ RLS via `SET LOCAL app.current_region` on every DB query
- ✅ RBAC enforced in both UI (menu visibility) and API (403 for unauthorized access)
- ✅ Bold Reports embedded in Reports section
- ✅ Bold BI embedded in Dashboard section
- ✅ Report Scheduler with email delivery
- ✅ Multi-tenant: connect to tenant-specific DB using JWT `tenantId`
- ✅ All 14 CRM tables utilized
- ✅ 12 months pre-seeded data (August 2025 – July 2026) available

---

## PROMPT END
